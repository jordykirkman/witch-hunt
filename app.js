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

let assignRoles = function(lobbyId){
  let playerKeys   = Object.keys(lobbies[lobbyId]['players']),
    playerCount    = playerKeys.length,
    desiredWitches = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
    assigned       = 0,
    assignWitch    = function(){
      let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
        role  = lobbies[lobbyId]['players'][playerKeys[key]]['role']
      if(role === 'witch'){
        this.call(this)
        return
      }
      assigned ++
      lobbies[lobbyId]['players'][playerKeys[key]]['role'] = 'witch'
    }

  while(assigned < desiredWitches){
    assignWitch.call(this)
  }

  let playerArray = playerMapToArray(lobbies[lobbyId]['players'])
  io.sockets.in(lobbyId).emit('playerUpdate', {players: playerArray})
}

let checkWinCondition = function(playerMap, lobbyId){
  let livingPlayers = 0,
    witches         = 0
  for(let key in playerMap){
    if(!playerMap[key]['isDead']){
      livingPlayers ++
    }
    if(playerMap[key]['role'] === 'witch'){
      witches ++
    }
  }
  console.log(witches, livingPlayers)
  if(witches >= (livingPlayers - witches)){
    if(lobbies[lobbyId]['dayTimer']){
      clearTimeout(lobbies[lobbyId]['dayTimer'])
    }
    return 'witches'
  }
  if(witches === 0){
    if(lobbies[lobbyId]['dayTimer']){
      clearTimeout(lobbies[lobbyId]['dayTimer'])
    }
    return 'villagers'
  }
  return false
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
    lobbies[newLobbyId]['players'][ioEvent.username]['skip'] = false
    lobbies[newLobbyId]['players'][ioEvent.username]['role'] = 'villager'
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
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['skip'] = false
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['role'] = 'villager'
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('kill', function(ioEvent){
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = true

    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    console.log(gameOver)
    if(gameOver){
      console.log(gameOver)
      if(gameOver === 'witches'){
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'witches'})
      } else {
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'villagers'})
      }
      return
    }

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
    let playerCount = 0,
      voteCount     = 0,
      skipCount     = 0
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      if(!lobbies[ioEvent.lobbyId]['players'][key]['isDead']){
        playerCount ++
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
      }
    }

    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      if(gameOver === 'witches'){
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'witches'})
      } else {
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'villagers'})
      }
      return
    }

    // if enough people have skipped to prevent a vote, end the day
    if(skipCount > (playerCount / 2)){
      endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

    // if everyone has voted, end the day
    if(voteCount + skipCount === playerCount){
      endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

  })

  socket.on('ready', function(ioEvent){
    io.sockets.in(ioEvent.lobbyId).emit('start')
    assignRoles.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
    startDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

  socket.on('disconnect', function () {
    console.log('A user disconnected');
  });

})

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})