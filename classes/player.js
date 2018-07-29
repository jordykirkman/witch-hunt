const events = require('../socket/index')
const playerMapToArray = require('../modules/player-map-to-array')
module.exports = class Player {
  constructor(gameId, id, username, role, isCreator, ai, isDead, skip, voteFor, isMarked) {
    this.gameId       = gameId
    this.ai           = ai
    this.id           = id
    this.isCreator    = isCreator
    this.isDead       = isDead
    this.isMarked     = isMarked
    this.role         = role
    this.skip         = skip
    this.username     = username
    this.voteFor      = voteFor
    this.trialVote    = null
    this.disconnected = false
    this.events = events
    this.playerMapToArray = playerMapToArray
  }
  asMap() {
    return new Object({
      gameId:     this.gameId,
      ai:         this.ai,
      id:         this.id,
      isCreator:  this.isCreator,
      isDead:     this.isDead,
      isMarked:   this.isMarked,
      role:       this.role,
      skip:       this.skip,
      username:   this.username,
      voteFor:    this.voteFor,
      trialVote:  this.trialVote,
      killVote:   [],
      ghostVote:  []
    })
  }
}