module.exports = class Player {
  constructor(id, isCreator, isDead, role, skip, username, voteFor) {
    this.id           = id;
    this.isCreator    = isCreator;
    this.isDead       = isDead;
    this.role         = role;
    this.skip         = skip;
    this.username     = username;
    this.voteFor      = voteFor;
    this.disconnected = false;
  }
  asMap() {
    return new Object({
      id:         this.id,
      isCreator:  this.isCreator,
      isDead:     this.isDead,
      role:       this.role,
      skip:       this.skip,
      username:   this.username,
      voteFor:    this.voteFor,
      killVote:   [],
      ghostVote:  []
    })
  }
}