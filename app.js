var express = require('express')
var nid = require('nid')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
app.use(express.static('../witch-hunt-client/build'))

var lobbies = {}

io.sockets.on('connection', function(socket) {
  console.log('a user connected')

  socket.on('create', function(ioEvent){
    var newLobbyId = nid()
    socket.join(newLobbyId)
    lobbies[newLobbyId] = {}
    lobbies[newLobbyId]['players'] = {}
    lobbies[newLobbyId]['players'][ioEvent.username] = {}
    socket.emit('created', {lobbyId: newLobbyId})
    socket.emit('joined', {username: ioEvent.username})
  })

  socket.on('join', function(ioEvent){
    socket.join(ioEvent.lobbyId)

    lobbies[ioEvent.lobbyId] = {}
    lobbies[ioEvent.lobbyId]['players'] = {}
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username] = {}
  })

  socket.on('kill', function(ioEvent){
    lobbies[ioEvent.lobbyId]['players'][ioEvent.username]['isDead'] = true
    socket.in(ioEvent.lobbyId).emit('death', {username: ioEvent.username})
  })

  socket.on('submitVote', function(ioEvent){
    let eventPlayer = lobbies[ioEvent.lobbyId]['players'][ioEvent.username]
    eventPlayer['vote'] += 1
    socket.in(ioEvent.lobbyId).emit('vote', {username: ioEvent.username})
    let playerCount = 0
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      if(lobbies[ioEvent.lobbyId]['players'][key]['isDead'] === false){
        playerCount += 1
      }
    }
    if(eventPlayer['vote'] >= (playerCount / 2)){
      eventPlayer['isDead'] = true
      socket.in(ioEvent.lobbyId).emit('death', {username: ioEvent.username})
    }
  })

})

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})