module.exports = function(playerMap) {
  // change our player key map to an array to send back to web client
  let newMap = {}
  let playerArray = []
  for(let key in playerMap){
    newMap[key] = playerMap[key].asMap()
  }
  for(let playerId in newMap){
    if(newMap[playerId].voteFor){
      // the player this person votes to kill
      const voteForPlayerId = newMap[playerId].voteFor
      // ghostVote and killVote are arrays those hold vote counts
      if(newMap[voteForPlayerId]){
        const voteType = newMap[playerId].isDead ? 'ghostVote' : 'killVote'
        newMap[voteForPlayerId][voteType].push({user: playerId})
      }
    }
  }
  for(let playerId in newMap){
    playerArray.push(newMap[playerId])
  }
  return playerArray
}