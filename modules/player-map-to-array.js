module.exports = function(playerMap) {
  // change our player key map to an array to send back to web client
  let newMap = {}
  let playerArray = []
  for(let key in playerMap){
    newMap[key] = playerMap[key].asMap()
  }
  for(let key in newMap){
    if(newMap[key].voteFor){
      // the player this person votes to kill
      const voteForPlayerId = newMap[key].voteFor
      // ghostVote and killVote are arrays those hold vote counts
      const voteType = newMap[key].isDead ? 'ghostVote' : 'killVote'
      newMap[voteForPlayerId][voteType].push({user: key})
    }
  }
  for(let key in newMap){
    playerArray.push(newMap[key])
  }
  return playerArray
}