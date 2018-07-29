const playerMapToArray = require('../modules/player-map-to-array')
const lobbies = require('../constants/lobbies')
/*

    ,-----------.
   (_\           \
      |           |
      |           |
      |           |
      |           |
     _|           |
    (_/_____(*)___/
             \\
              ))
              ^
*/

module.exports = function(ioEvent, io){
  let game = lobbies[ioEvent.lobbyId]
  if(game.players[ioEvent.from].isDead){
    if(ioEvent.lobbyId){
      io.sockets.to(ioEvent.lobbyId).emit('error', {error: 'the dead cannot vote'})
    }
    return
  }
  if(ioEvent.skip){
    // set vote to null if they skip
    if(game.players[ioEvent.from].voteFor === 'skip'){
      game.players[ioEvent.from].voteFor = null
    } else {
      game.players[ioEvent.from].voteFor = 'skip'
    }
  } else {
    // let them cancel or change a vote
    if(game.players[ioEvent.from].voteFor === ioEvent.user){
      game.players[ioEvent.from].voteFor = null
    } else {
      game.players[ioEvent.from].voteFor = ioEvent.user
    }
  }

  let playerArray = playerMapToArray(game.players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})

  // count our alive players
  let playerCount = 0,
    playerVotes   = {}
  for(let key in game.players){
    if(!game.players[key].isDead && !game.players[key].disconnected){
      playerCount ++
      if(game.players[key].voteFor && game.players[key].voteFor !== 'skip'){
        // add the player id being voted for as a key in playerVotes
        if(playerVotes[game.players[key].voteFor]){
          playerVotes[game.players[key].voteFor] ++
        } else {
          playerVotes[game.players[key].voteFor] = 1
        }
      }
    }
  }
  // if there is a majority vote, put the player on trial or kill them
  for(var playerId in playerVotes){
    // is there a player id with greater than 50% of the votes?
    if(playerVotes[playerId] > (playerCount / 2)){
      game.gameSettings.onTrial = game.players[playerId]
      io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', game.gameSettings)
    }
  }

  // if enough people have skipped to prevent a vote, end the day
  // if(skipCount > (playerCount / 2)){
  //   startNight.call(this, ioEvent.lobbyId, game)
  //   return
  // }

  // if everyone has voted, end the day
  // if(voteCount + skipCount === playerCount){
  //   startNight.call(this, ioEvent.lobbyId, game)
  //   return
  // }
}