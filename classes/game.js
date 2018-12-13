const gameText = require('../constants/game-text')
const playerMapToArray = require('../modules/player-map-to-array')
const rng = require('../modules/rng')

/*
  Class representing a game lobby
*/

module.exports = class Game {
  constructor(id, io, players) {
    this.id       = id
    this.io       = io
    this.dayTimer = undefined
    this.gameSettings = {
      lobbyId:      id,
      witchText:    gameText.witchText,
      dayText:      gameText.dayText,
      villagerText: gameText.villagerText,
      watchList:    {},
      messages:     [],
      markedThisTurn: {}
    }
    this.players = players
    this.addPlayer = this.addPlayer.bind(this)
    this.startDay = this.startDay.bind(this)
    this.startTrial = this.startTrial.bind(this)
    this.startNight = this.startNight.bind(this)
    this.showRole = this.showRole.bind(this)
    this.removeDisconnectedPlayers = this.removeDisconnectedPlayers.bind(this)
    this.assignRoles = this.assignRoles.bind(this)
    this.checkWinCondition = this.checkWinCondition.bind(this)
    this.endGame = this.endGame.bind(this)
  }

  /*
    add a player to this game lobby
  */
  addPlayer(player){
    this.players[player.id] = player
  }

  /*
    begin the day sequence
  */
  startDay(){
    // day is for people to vote
    clearTimeout(this.dayTimer)
    // delete those who failed or skipped
    let watchList = this.gameSettings.watchList
    for(let watcherId in watchList){
      let castSucceeded = rng(0.8)
      if(!castSucceeded){
        delete this.gameSettings.watchList[watcherId]
        this.io.sockets.to(watcherId).emit('notification', {notification: 'You hear a scary noise and stay home. (seen as home)'})
      }
      if(this.gameSettings.watchList[watcherId] === 'skip'){
        delete this.gameSettings.watchList[watcherId]
      }
    }
    // tell everyone who watches someone if they were home
    for(let watcherId in this.gameSettings.watchList){
      // userWatched is the value(user watched) assigned to watcherId(user watching)
      let userWatchedId = this.gameSettings.watchList[watcherId]
      // did the person you are watching leave the house?
      let gameSettings = this.gameSettings
      if(gameSettings.watchList[userWatchedId] || gameSettings.markedThisTurn[userWatchedId]){
        this.io.sockets.to(watcherId).emit('notification', {notification: `${this.players[userWatchedId].username} was missing`})
      } else {
        this.io.sockets.to(watcherId).emit('notification', {notification: `${this.players[userWatchedId].username} was home`})
      }
    }
    // mark the users who need it
    for(let key in this.gameSettings.markedThisTurn){
      let userMarked = this.gameSettings.markedThisTurn[key]
      this.players[userMarked].isMarked = true
    }
    let playerArray = playerMapToArray(this.players)
    this.io.sockets.in(this.id).emit('gameUpdate', {watching: null, marking: null, players: playerArray})
    // reset lists
    this.gameSettings.watchList = {}
    this.gameSettings.markedThisTurn = {}
    // did someone win?
    let gameOver = this.checkWinCondition.call(this, this['players'], this.id)
    if(gameOver){
      for(let key in this.players){
        if(this.players[key].isMarked){
          this.players[key].isDead = true
        }
      }
      let playerArray = playerMapToArray(this.players)
      this.io.sockets.in(this.id).emit('gameUpdate', {players: playerArray})
      this.endGame.call(this, gameOver, this.id)
      return
    }
    // send day message
    this.gameSettings.time = 'day'
    // reset kill votes
    for(let key in this.players){
      this.players[key].killVote = null
      // trigger AIs to make their move
      if(this.players[key].ai){
        this.players[key].makeDecision('day', this.players, this.io)
      }
    }
    // push results to client
    this.io.sockets.in(this.id).emit('gameUpdate', this.gameSettings)
    let game = this
    this.dayTimer = setTimeout(function(){
      if(game.gameSettings.onTrial){
        game.startTrial.call(game, game.id)
        return
      }
      game.startNight.call(game, game.id)
    }, 15000)
    this.io.sockets.in(this.id).emit('setTimer', {timer: 15})
  }

  /*
    begin trial sequence
    trial is for people to decide if a person is guilty or not
  */
  startTrial(){
    clearTimeout(this.dayTimer)
    // skip if no one is on trial
    if(!this.gameSettings.onTrial){
      this.startNight.call(this, this.id)
    }
    this.gameSettings.time         = 'trial'
    this.gameSettings.messages     = []
    for(let key in this.players){
      this.players[key].trialVote   = null
      this.players[key].voteFor     = null
    }
    this.io.sockets.in(this.id).emit('gameUpdate', this.gameSettings)
    let playerArray = playerMapToArray(this.players)
    this.io.sockets.in(this.id).emit('gameUpdate', {players: playerArray})
    let game = this
    this.dayTimer = setTimeout(function(){
      game.startNight.call(game, game.id)
    }, 10000)
    for(let key in this.players){
      if(this.players[key].ai){
        this.players[key].makeDecision('trial', this.players, this.io)
      }
    }
    this.io.sockets.in(this.id).emit('setTimer', {timer: 10})
  }

  /*
    begin the night sequence
  */
  startNight(){
    clearTimeout(this.dayTimer)
    // see if there is a trial going and check for win condition before proceeding
    let playerCount = 0,
      yesCount      = 0
    if(this.gameSettings.onTrial){
      let trialUserId   = this.gameSettings.onTrial.id
      for(let playerId in this.players){
        if(!this.players[playerId].isDead){
          playerCount += 1
          if(this.players[playerId].trialVote === 'yes'){
            yesCount += 1
          }
          // reset it once we have the count
          this.players[playerId].trialVote = null
        }
        if(yesCount > (playerCount / 2)){
          this.players[trialUserId].isDead = true
          let playerArray = playerMapToArray(this.players)
          this.io.sockets.in(this.id).emit('gameUpdate', {players: playerArray})
          let gameOver = this.checkWinCondition.call(this, this.players, this.id)
          if(gameOver){
            this.endGame.call(this, gameOver, this.id)
            return
          }
        }
      }
      this.gameSettings.onTrial = null
    }
    // reset dem killBotes bb
    for(let playerId in this.players){
      this.players[playerId].voteFor  = null
      this.players[playerId].skip     = false
    }
    // send the players back with reset killVotes
    let playerArray = playerMapToArray(this['players'])
    this.io.sockets.in(this.id).emit('gameUpdate', {players: playerArray})
    // reset the timer
    let game = this
    this.dayTimer = setTimeout(game.startDay, 10000)
    this['gameSettings']['time'] = 'night'
    this.io.sockets.in(this.id).emit('gameUpdate', this['gameSettings'])
    this.io.sockets.in(this.id).emit('setTimer', {timer: 10})

    for(let key in this.players){
      if(this.players[key].ai){
        this.players[key].makeDecision('night', this.players, this.io)
      }
    }
  
    // let playerIds       = Object.keys(this.players)
    //   playerCount       = playerIds.length,
    //   audioNoisesLength = audioNoises.length
    // audio isnt allowed on mobile :(
    // this.nightSoundsInterval = setInterval(function(){
    //   let playerId = playerIds[Math.floor(Math.random() * playerCount)],
    //     audioName = audioNoises[Math.floor(Math.random() * audioNoisesLength)]
    //   io.sockets.to(playerId).emit('audio', {fileName: audioName})
    // }, 8000)
    // TODO modify this by player count?  
  }

  // TODO: deprecated spell? make a spell factory?
  showRole(){
    for(let playerId in this.players){
      let role = this.players[playerId].role
      this.io.sockets.to(playerId).emit('notification', {notification: `you are a ${role}`, messageClass: role})
    }
    this.dayTimer = setTimeout(this.startDay, 6000)
  }
  
  removeDisconnectedPlayers(){
    for(let playerId in this.players){
      if(this.players[playerId].disconnected){
        // if the player is not here when the game starts, get rid of them
        delete this.players[playerId]
      }
    }
  }
  
  assignRoles(){
    let playerKeys      = Object.keys(this.players),
      playerCount       = playerKeys.length,
      desiredWitches    = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
      // desiredProphets   = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
      desiredProphets   = 0,
      assignedWitches   = 0,
      assignedProphets  = 0,
      assignWitches     = function(){
        let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
          role  = this.players[playerKeys[key]].role
        if(role === 'witch' || role === 'prophet'){
          assignWitches.call(this)
          return
        }
        assignedWitches ++
        this.players[playerKeys[key]]['role'] = 'witch'
      },
      assignProphets    = function(){
        let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
          role  = this.players[playerKeys[key]]['role']
        if(role === 'witch' || role === 'prophet'){
          assignProphets.call(this)
          return
        }
        assignedProphets ++
        this.players[playerKeys[key]]['role'] = 'prophet'
      }
  
    // reset roles from last game, deaths and votes
    for(let key in this.players){
      this.players[key].role      = 'villager'
      this.players[key].isDead    = false
      this.players[key].killVote  = null
    }
  
    // assign witches
    while(assignedWitches < desiredWitches){
      assignWitches.call(this)
    }
    // assign vilagers
    while(assignedProphets < desiredProphets){
      assignProphets.call(this)
    }
  
    let playerArray = playerMapToArray(this.players)
    this.io.sockets.in(this.id).emit('gameUpdate', {players: playerArray})
  }

  checkWinCondition(){
    let livingPlayers = 0,
      witches         = 0
    for(let key in this.players){
      if(!this.players[key]['isDead'] && !this.players[key]['isMarked']){
        livingPlayers ++
        if(this.players[key]['role'] === 'witch'){
          witches ++
        }
      }
    }
  
    if(witches >= (livingPlayers - witches)){
      if(this.dayTimer){
        clearTimeout(this.dayTimer)
      }
      return 'witches'
    }
    if(witches === 0){
      if(this.dayTimer){
        clearTimeout(this.dayTimer)
      }
      return 'villagers'
    }
    return false
  }
  
  endGame(){
    clearTimeout(this.dayTimer)
    // add a timer for dramatic effect
    let game = this
    this.dayTimer = setTimeout(function(){
      game['gameSettings'].started = false
      if(game.winner === 'witches'){
        game.gameSettings.winner = 'witches'
        game.io.sockets.in(game.id).emit('notification', {notification: 'Witches triumph', messageClass: 'witch'})
        game.io.sockets.in(game.id).emit('gameUpdate', {winner: 'witches', started: false, instructions: null})
      } else {
        game.gameSettings.winner = 'villagers'
        game.io.sockets.in(game.id).emit('notification', {notification: 'Villagers defend their homeland', messageClass: 'villager'})
        game.io.sockets.in(game.id).emit('gameUpdate', {winner: 'villagers', started: false, instructions: null})
      }
    }, 3000)
  }

}