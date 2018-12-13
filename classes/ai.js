const Player = require('./player')

// const decisionLog = {

// }

module.exports = class Ai extends Player {

  constructor(gameId, id, username, role, isCreator, ai, isDead, skip, voteFor, isMarked, elect, io, vote, kill){
    super(gameId, id, username, role, isCreator, ai, isDead, skip, voteFor, isMarked)
    this.elect = elect
    this.vote = vote
    this.kill = kill
    this.io = io
  }

  asMap() {
    return new Object({
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

  makeDecision(time, players){
    // console.log('made decision')
    switch (time) {
    case 'day':
      this.dayDecision(players)
      break
    case 'night':
      this.nightDecision(players)
      break
    case 'trial':
      this.trialDecision(players)
      break
    }
  }

  dayDecision(players){
    if(this.isDead){
      return
    }
    let playersToSpyOn = this.playerMapToArray(players).filter((p) => {
      return !p.isDead
    })
    let player = Math.ceil(Math.random() * playersToSpyOn.length)
    this.elect({
      from: this.id,
      user: player.id,
      lobbyId: this.gameId
    },
    this.io
    )
  }

  nightDecision(players){
    if(this.isDead){
      return
    }
    let playersToSpyOn = this.playerMapToArray(players).filter((p) => {
      return !p.isDead && !p.isMarked
    })
    let playerIndex = Math.ceil(Math.random() * playersToSpyOn.length)
    let player = playersToSpyOn[playerIndex]
    if(this.role === 'witch'){
      this.kill({
        from: this.id,
        user: player.id,
        lobbyId: this.gameId
      },
      this.io
      )
    }
  }

  trialDecision(players){
    if(this.isDead){
      return
    }
    let playersToSpyOn = this.playerMapToArray(players).filter((p) => {
      return !p.isDead
    })
    let player = Math.ceil(Math.random() * playersToSpyOn.length)
    this.vote({
      from: this.id,
      user: player.id,
      lobbyId: this.gameId
    },
    this.io
    )
  }

}