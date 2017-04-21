module.exports = function(playerMap) {
  // change our player key map to an array to send back to web client
  let newMap = {}
  let playerArray = []
  for(let key in playerMap){
    newMap[key] = playerMap[key].asMap()
  }
  for(let key in newMap){
    if(newMap[key].voteFor){
      let voteType = newMap[key]['isDead'] ? 'ghostVote' : 'killVote'
      newMap[newMap[key]['voteFor']][voteType].push({user: key})
    }
  }
  for(let key in newMap){
    playerArray.push(newMap[key])
  }
  return playerArray
}