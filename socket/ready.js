const playerMapToArray = require('../modules/player-map-to-array')
const lobbies = require('../constants/lobbies')
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

module.exports = function(ioEvent, socket, io){
  let game = lobbies[ioEvent.lobbyId]
  game.gameSettings.started  = true
  game.gameSettings.time     = 'dawn'
  game.gameSettings.winner   = null
  game.gameSettings.onTrial  = null
  game.gameSettings.messages = []
  // reset votes
  for(let playerId in game.players){
    game.players[playerId].voteFor    = null
    game.players[playerId].trialVote  = null
    game.players[playerId].skip       = false
  }
  // send the players back with reset killVotes
  let playerArray = playerMapToArray(game['players'])
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  // send the reset game settings
  socket.emit('gameUpdate', game.gameSettings)
  game.removeDisconnectedPlayers()
  game.assignRoles()
  game.showRole()
}