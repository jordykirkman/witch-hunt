/*
                   )
                  (_)
                 .-'-.
                 |   |
                 |   |
                 |   |
                 |   |
               __|   |__   .-.
            .-'  |   |  `-:   :
           :     `---'     :-'
            `-._       _.-'
                '""""""
*/

module.exports = function(ioEvent, socket, lobbies, io){
  if(!lobbies[ioEvent.lobbyId].players[socket.id]){
    return
  }
  let messageUsername = lobbies[ioEvent.lobbyId].players[socket.id].username
  lobbies[ioEvent.lobbyId].gameSettings.messages.push({
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