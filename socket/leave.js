const playerMapToArray = require('../modules/player-map-to-array')
const lobbies = require('../constants/lobbies')
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

module.exports = function(ioEvent, socket, io){
  let game = lobbies[ioEvent.lobbyId]
  if(!game){
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
  if(Object.keys(game.players).length === 1){
    delete lobbies[ioEvent.lobbyId]
    return
  } else {
    if(game.players[socket.id]){
      // otherwise kill their player in this game
      if(game.gameSettings.started){
        game.players[socket.id].isDead       = true
        game.players[socket.id].disconnected = true
      } else {
        // the game is not started so just get rid of the player
        delete game.players[socket.id]
      }
    }
    // and leave the room
    socket.leave(ioEvent.lobbyId)
    // check if there are any connected clients in the lobby
    let lobbyEmpty = true
    for(var playerId in game.players){
      if(!game.players[playerId].disconnected){
        lobbyEmpty = false
      }
    }
    if(lobbyEmpty){
      delete lobbies[ioEvent.lobbyId]
      return
    }
    // update remaining clients
    let playerArray = playerMapToArray(game.players)
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  }
}