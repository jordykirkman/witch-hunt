module.exports = function(lobby){
  let playerKeys      = Object.keys(lobby['players']),
    playerCount       = playerKeys.length,
    desiredWitches    = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
    desiredProphets   = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
    assignedWitches   = 0,
    assignedProphets  = 0,
    lobbyId           = lobby.lobbyId,
    assignWitches     = function(){
      let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
        role  = lobby['players'][playerKeys[key]]['role']
      if(role === 'witch' || role === 'prophet'){
        assignWitches.call(this)
        return
      }
      assignedWitches ++
      lobby['players'][playerKeys[key]]['role'] = 'witch'
    },
    assignProphets    = function(){
      let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
        role  = lobby['players'][playerKeys[key]]['role']
      if(role === 'witch' || role === 'prophet'){
        assignProphets.call(this)
        return
      }
      assignedProphets ++
      lobby['players'][playerKeys[key]]['role'] = 'prophet'
    }

  // reset roles from last game, deaths and votes
  for(let key in lobby['players']){
    lobby.players[key].role      = 'villager'
    lobby.players[key].isDead    = false
    lobby.players[key].killVote  = null
  }

  // assign witches
  while(assignedWitches < desiredWitches){
    assignWitches.call(this)
  }
  // assign vilagers
  // while(assignedProphets < desiredProphets){
  //   assignProphets.call(this)
  // }

  let playerArray = playerMapToArray(lobby['players'])
  io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
}