const playerMapToArray = require('../modules/player-map-to-array')
/*
  Away with you!
  ----------------------------------------------------------
              ,-' ;  ! `-.
              / :  !  :  . \
            |_ ;   __:  ;  |
            )| .  :)(.  !  |
            |"    (##)  _  |
            |  :  ;`'  (_) (
            |  :  :  .     |
            )_ !  ,  ;  ;  |
            || .  .  :  :  |
            |" .  |  :  .  |
            |mt-2_;----.___|
*/

module.exports = function(ioEvent, socket, lobbies, io){
  if(!lobbies[ioEvent.lobbyId]){
    return
  }
  socket.emit('gameUpdate', {
    user:               {},
    lobbyId:            '',
    joinLobbyId:        '',
    instructions:       null,
    playerNotification: null,
    showNotification:   false,
    notificationClass:  '',
    players:            [],
    create:             true,
    started:            false,
    winner:             null,
    time:               'night'
  })
  // if the lobby is empty delete it
  if(Object.keys(lobbies[ioEvent.lobbyId].players).length === 1){
    delete lobbies[ioEvent.lobbyId]
    return
  } else {
    if(lobbies[ioEvent.lobbyId].players[socket.id]){
      // otherwise kill their player in this game
      if(lobbies[ioEvent.lobbyId].gameSettings.started){
        lobbies[ioEvent.lobbyId].players[socket.id].isDead       = true
        lobbies[ioEvent.lobbyId].players[socket.id].disconnected = true
      } else {
        // the game is not started so just get rid of the player
        delete lobbies[ioEvent.lobbyId].players[socket.id]
      }
    }
    // and leave the room
    socket.leave(ioEvent.lobbyId)
    // check if there are any connected clients in the lobby
    let lobbyEmpty = true
    for(var playerId in lobbies[ioEvent.lobbyId].players){
      if(!lobbies[ioEvent.lobbyId].players[playerId].disconnected){
        lobbyEmpty = false
      }
    }
    if(lobbyEmpty){
      delete lobbies[ioEvent.lobbyId]
      return
    }
    // update remaining clients
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  }
}