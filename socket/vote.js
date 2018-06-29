const playerMapToArray = require('../modules/player-map-to-array')
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

module.exports = function(ioEvent, socket, lobbies, io){
  if(lobbies[ioEvent.lobbyId]['players'][ioEvent.from].isDead){
    io.sockets.to(socket.id).emit('error', {error: 'the dead cannot vote'})
    return
  }
  if(ioEvent.skip){
    // set vote to null if they skip
    if(lobbies[ioEvent.lobbyId].players[ioEvent.from].voteFor === 'skip'){
      lobbies[ioEvent.lobbyId].players[ioEvent.from].voteFor = null
    } else {
      lobbies[ioEvent.lobbyId].players[ioEvent.from].voteFor = 'skip'
    }
  } else {
    // let them cancel or change a vote
    if(lobbies[ioEvent.lobbyId].players[ioEvent.from].voteFor === ioEvent.user){
      lobbies[ioEvent.lobbyId].players[ioEvent.from].voteFor = null
    } else {
      lobbies[ioEvent.lobbyId].players[ioEvent.from].voteFor = ioEvent.user
    }
  }

  let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})

  // count our alive players
  let playerCount = 0,
    playerVotes   = {}
  for(let key in lobbies[ioEvent.lobbyId]['players']){
    if(!lobbies[ioEvent.lobbyId]['players'][key]['isDead'] && !lobbies[ioEvent.lobbyId]['players'][key]['disconnected']){
      playerCount ++
      if(lobbies[ioEvent.lobbyId]['players'][key]['voteFor'] && lobbies[ioEvent.lobbyId]['players'][key]['voteFor'] !== 'skip'){
        // add the player id being voted for as a key in playerVotes
        if(playerVotes[lobbies[ioEvent.lobbyId]['players'][key]['voteFor']]){
          playerVotes[lobbies[ioEvent.lobbyId]['players'][key]['voteFor']] ++
        } else {
          playerVotes[lobbies[ioEvent.lobbyId]['players'][key]['voteFor']] = 1
        }
      }
    }
  }
  // if there is a majority vote, put the player on trial or kill them
  for(var playerId in playerVotes){
    // is there a player id with greater than 50% of the votes?
    if(playerVotes[playerId] > (playerCount / 2)){
      lobbies[ioEvent.lobbyId].gameSettings.onTrial = lobbies[ioEvent.lobbyId].players[playerId]
      io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
    }
  }

  // if enough people have skipped to prevent a vote, end the day
  // if(skipCount > (playerCount / 2)){
  //   startNight.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  //   return
  // }

  // if everyone has voted, end the day
  // if(voteCount + skipCount === playerCount){
  //   startNight.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  //   return
  // }
}