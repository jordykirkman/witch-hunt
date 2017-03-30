var express = require('express')
var nid = require('nid')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
app.use(express.static('../witch-hunt-client/build'))

let lobbies = {}

// change our player key map to an array to send back to web client
let playerMapToArray = (playerMap) => {
  let playerArray = []
  for(let key in playerMap){
    playerArray.push(playerMap[key])
  }
  return playerArray
}

let startDay = function(lobbyId){
  lobbies[lobbyId]['day'] = true
  io.sockets.in(lobbyId).emit('day')
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('night')
  }, 60000)
}

let endDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  for(let key in lobbies[lobbyId]['players']){
    lobbies[lobbyId]['players'][key]['killVote'] = []
    lobbies[lobbyId]['players'][key]['skip']     = false
  }
  io.sockets.in(lobbyId).emit('night')
}

io.sockets.on('connection', function(socket) {
  console.log('a user connected')

  socket.on('create', function(ioEvent){
    var newLobbyId = nid()
    socket.join(newLobbyId)
    lobbies[newLobbyId] = {}

    // TODO condence into add player method
    lobbies[newLobbyId]['players'] = {}
    lobbies[newLobbyId]['players'][ioEvent.username] = {}
    lobbies[newLobbyId]['players'][ioEvent.username]['username'] = ioEvent.username
    lobbies[newLobbyId]['players'][ioEvent.username]['killVote'] = []
    lobbies[newLobbyId]['players'][ioEvent.username]['isDead'] = false
    io.sockets.in(newLobbyId).emit('created', {lobbyId: newLobbyId})
    let playerArray = playerMapToArray(lobbies[newLobbyId]['players'])
    io.sockets.in(newLobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('join', function(ioEvent){
    socket.join(ioEvent.lobbyId)

    // TODO condence into add player method
    if(!lobbies[ioEvent.lobbyId]){
      return
    }
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username] = {}
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['username'] = ioEvent.username
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['killVote'] = []
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = false
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('kill', function(ioEvent){
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = true
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
    startDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

  socket.on('submitVote', function(ioEvent){
    if(ioEvent.skip){
      lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['skip'] = true
    } else {
      lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['killVote'].push({username: ioEvent.from})
    }

    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})

    // count our alive players
    let playerCount = 0
    let voteCount = 0
    let skipCount = 0
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      if(!lobbies[ioEvent.lobbyId]['players'][key]['isDead']){
        playerCount += 1
      }
      if(ioEvent.username){
        voteCount += lobbies[ioEvent.lobbyId]['players'][key]['killVote'].length
      }
      if(ioEvent.skip){
        skipCount += lobbies[ioEvent.lobbyId]['players'][key]['skip'] ? 1 : 0
      }
    }
    
    // if there is a majority vote, kill the player
    if(ioEvent.username){
      if(lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['killVote'].length > (playerCount / 2)){
        lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = true
        let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
        io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
        endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
        return
      }
    }

    // if enough people have skipped to prevent a vote, end the day
    if(skipCount > (playerCount / 2)){
      endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

    if(voteCount + skipCount === playerCount){
      endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

  })

  socket.on('ready', function(ioEvent){
    io.sockets.in(ioEvent.lobbyId).emit('start')
    startDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

})

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})