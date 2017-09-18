module.exports = class Player {
  constructor(id, username, role, isCreator, isDead, skip, voteFor, isMarked) {
    this.id           = id;
    this.isCreator    = isCreator;
    this.isDead       = isDead;
    this.isMarked     = isMarked,
    this.role         = role;
    this.skip         = skip;
    this.username     = username;
    this.voteFor      = voteFor;
    this.trialVote    = null;
    this.disconnected = false;
  }
  asMap() {
    return new Object({
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