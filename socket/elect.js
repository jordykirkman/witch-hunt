const playerMapToArray = require('../modules/player-map-to-array')
/*
                ,/   *
              _,'/_   |
              `(")' ,'/
          _ _,-H-./ /
          \_\_\.   /
            )" |  (
          __/   H   \__
          \    /|\    /
          `--'|||`--'
              ==^==
*/

module.exports = function(ioEvent, socket, lobbies, io){
  if(lobbies[ioEvent.lobbyId].players[ioEvent.from].isDead){
    io.sockets.to(socket.id).emit('error', {error: 'the dead cannot vote'})
    return
  }
  lobbies[ioEvent.lobbyId].players[ioEvent.from].trialVote = ioEvent.vote
  let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
}