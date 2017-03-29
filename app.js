var express = require('express')
var nid = require('nid')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
app.use(express.static('../witch-hunt-client/build'))

let lobbies = {}

// let modifyPlayer = function()

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
    let playerArray = []
    for(let key in lobbies[newLobbyId]['players']){
      playerArray.push(lobbies[newLobbyId]['players'][key])
    }
    io.sockets.in(newLobbyId).emit('joined', {players: playerArray})
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
    let playerArray = []
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      playerArray.push(lobbies[ioEvent.lobbyId]['players'][key])
    }
    io.sockets.in(ioEvent.lobbyId).emit('joined', {players: playerArray})
  })

  socket.on('kill', function(ioEvent){
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = true
    let playerArray = []
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      playerArray.push(lobbies[ioEvent.lobbyId]['players'][key])
    }
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('submitVote', function(ioEvent){
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['killVote'].push({username: ioEvent.from})
    // io.sockets.in(ioEvent.lobbyId).emit('vote', {username: ioEvent.username})
    // count our alive players
    let playerCount = 0
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      if(lobbies[ioEvent.lobbyId]['players'][key]['isDead'] === false){
        playerCount += 1
      }
    }
    // if there is a majority vote, kill the player
    if(lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['killVote'].length >= (playerCount / 2)){
      lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = true
    }
    // format and return the array
    let playerArray = []
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      playerArray.push(lobbies[ioEvent.lobbyId]['players'][key])
    }
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

})

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})