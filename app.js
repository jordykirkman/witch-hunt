const express       = require('express'),
  path              = require('path'),
  app               = express(),
  http              = require('http').Server(app),
  io                = require('socket.io')(http),
  PORT              = process.env.WITCH_HUNT_PORT || 80,
  events            = require('./socket/index'),
  lobbies           = require('./constants/lobbies')

app.enable('trust proxy')
app.use(express.static(path.join(__dirname, '../witch-hunt-client/build')))

io.sockets.on('connection', function(socket) {
  console.log(`a user connected ${socket.id}`)

  socket.on('create', function(ioEvent){
    events.create(ioEvent, socket, io)
  })

  socket.on('reconnectClient', function(ioEvent){
    events.reconnect(ioEvent, socket, io)
  })

  socket.on('join', function(ioEvent){
    events.join(ioEvent, socket, io)
  })

  // TODO rework this so that it reveals at the start of dawn to add supsense
  socket.on('kill', function(ioEvent){
    events.kill(ioEvent, io)
  })

  socket.on('trialVote', function(ioEvent){
    events.elect(ioEvent, io)
  })

  socket.on('submitVote', function(ioEvent){
    events.vote(ioEvent, io)
  })

  socket.on('watch', function(ioEvent){
    events.watch(ioEvent, socket, io)
  })

  // if the user wants to leave, reset their client state and kill/delete their user
  socket.on('leaveLobby', function(ioEvent){
    events.leave(ioEvent, socket, io)
  })

  // this emits a role reveal back to a prophet that requests one
  socket.on('reveal', function(ioEvent, socket){
    events.reveal(ioEvent, socket, io)
  })

  socket.on('ready', function(ioEvent){
    events.ready(ioEvent, socket, io)
  })

  // currently just used for last words when hanging
  socket.on('message', function (ioEvent) {
    events.message(ioEvent, socket, io)
  })

  // just typing indicators
  socket.on('typing', function (ioEvent) {
    io.sockets.in(ioEvent.lobbyId).emit('typing', {from: socket.id})
  })

  socket.on('disconnect', function () {
    events.disconnect(socket, lobbies, io)
  })

})

http.listen(PORT, function () {
  console.log('Witch Hunt is running on ' + PORT)
})