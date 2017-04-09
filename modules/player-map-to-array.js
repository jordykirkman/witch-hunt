module.exports = function(playerMap) {
  // change our player key map to an array to send back to web client
  let newMap = Object.create(playerMap)
  let playerArray = []
  for(let key in newMap){
    newMap[key]['killVote']   = []
    newMap[key]['ghostVote']  = []
  }
  for(let key in newMap){
    if(newMap[key]['voteFor']){
      let voteType = newMap[key]['isDead'] ? 'ghostVote' : 'killVote'
      newMap[newMap[key]['voteFor']][voteType].push({user: key})
    }
  }
  for(let key in newMap){
    playerArray.push(playerMap[key])
  }
  return playerArray
}