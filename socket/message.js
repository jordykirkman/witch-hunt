const lobbies = require('../constants/lobbies')
/*
         ______________
    ()==(              (@==()
         '______________'|
           |             |
           |             |
         __)_____________|
    ()==(               (@==()
         '--------------'

*/

module.exports = function(ioEvent, socket, io){
  let game = lobbies[ioEvent.lobbyId]
  if(!game.players[socket.id]){
    return
  }
  let messageUsername = game.players[socket.id].username
  game.gameSettings.messages.push({
    message:  ioEvent.message,
    userId:   socket.id,
    username: messageUsername
  })
  io.sockets.in(ioEvent.lobbyId).emit('propegateMessage', {
    message:  ioEvent.message,
    userId:   socket.id,
    username: messageUsername
  })
}