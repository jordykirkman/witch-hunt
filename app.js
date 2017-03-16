var express = require('express')
var nid = require('nid')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
app.use(express.static('public'))

lobbies: {}

io.sockets.on('connection', function(socket) {
  console.log('a user connected')

  socket.on('start-lobby', function(){
    var newLobbyId = nid()
    socket.join(newLobbyId)
  })

  socket.on('join-lobby', function(joinRequest){
    socket.join(joinRequest.lobbyId)
    lobbies[joinRequest.lobbyId]['players'].push({'name': joinRequest.name})
  })

})

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})