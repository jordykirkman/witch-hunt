const playerMapToArray = require('../modules/player-map-to-array')
const lobbies = require('../constants/lobbies')
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

module.exports = function(ioEvent, io){
  let game = lobbies[ioEvent.lobbyId]
  if(game.players[ioEvent.from].isDead){
    if(ioEvent.lobbyId){
      io.sockets.to(ioEvent.lobbyId).emit('error', {error: 'the dead cannot vote'})
    }
    return
  }
  game.players[ioEvent.from].trialVote = ioEvent.vote
  let playerArray = playerMapToArray(game.players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
}