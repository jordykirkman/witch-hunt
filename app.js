const express       = require('express'),
  assignRoles       = require('./modules/assign-roles'),
  path              = require('path'),
  nid               = require('nid'),
  generateId        = require('./modules/generate-id'),
  generateName      = require('./modules/generate-name'),
  Player            = require('./classes/player'),
  Game              = require('./classes/game'),
  playerMapToArray  = require('./modules/player-map-to-array'),
  rng               = require('./modules/rng'),
  app               = express(),
  http              = require('http').Server(app),
  io                = require('socket.io')(http),
  PORT              = process.env.WITCH_HUNT_PORT || 80,
  gameText          = require('./constants/game-text'),
  events            = require('./socket/index'),

  // text
  villagerText      = gameText.villagerText,
  witchText         = gameText.witchText,
  dayText           = gameText.dayText,
  audioNoises       = gameText.audioNoises;

app.enable('trust proxy')
app.use(express.static(path.join(__dirname, '../witch-hunt-client/build')))

const lobbies = {}

// dawn is for prophets to check a role
const startDawn = function(lobbyId, message){
  // clearInterval(lobbies[lobbyId].nightSoundsInterval)
  message = message ? message : ''
  clearTimeout(lobbies[lobbyId].dayTimer)
  // tell everyone who died
  let playerArray = playerMapToArray(lobbies[lobbyId].players)
  io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
  // no point in dawn if no prophets are alive
  let prophetCount = 0
  for(let playerId in lobbies[lobbyId].players){
    let player = lobbies[lobbyId].players[playerId]
    if(player['role'] === 'prophet' && !player['isDead']){
      prophetCount ++
    }
  }
  // skip dawn if no prophets are alive
  if(prophetCount === 0){
    startDay.call(this, lobbyId)
    return
  }
  let instructionsMessage = `${message}A prophet gazes into the fire. Who do they see?`
  lobbies[lobbyId].gameSettings['time'] = 'dawn'
  lobbies[lobbyId].gameSettings['instructions'] = instructionsMessage
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId].gameSettings)
  lobbies[lobbyId].dayTimer = setTimeout(function(){
    startDay.call(this, lobbyId)
  }, 30000)
}

// day is for people to vote
const startDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  // delete those who failed or skipped
  for(let watcherId in lobbies[lobbyId].gameSettings.watchList){
    let castSucceeded = rng(0.8)
    if(!castSucceeded){
      delete lobbies[lobbyId].gameSettings.watchList[watcherId]
      io.sockets.to(watcherId).emit('notification', {notification: 'You hear a scary noise and stay home. (seen as home)'})
    }
    if(lobbies[lobbyId].gameSettings.watchList[watcherId] === 'skip'){
      delete lobbies[lobbyId].gameSettings.watchList[watcherId]
    }
  }
  // tell everyone who watches someone if they were home
  for(let watcherId in lobbies[lobbyId].gameSettings.watchList){
    // userWatched is the value(user watched) assigned to watcherId(user watching)
    let userWatchedId = lobbies[lobbyId].gameSettings.watchList[watcherId]
    // did the person you are watching leave the house?
    let gameSettings = lobbies[lobbyId].gameSettings
    if(gameSettings.watchList[userWatchedId] || gameSettings.markedThisTurn[userWatchedId]){
      io.sockets.to(watcherId).emit('notification', {notification: `${lobbies[lobbyId].players[userWatchedId].username} was missing`})
    } else {
      io.sockets.to(watcherId).emit('notification', {notification: `${lobbies[lobbyId].players[userWatchedId].username} was home`})
    }
  }
  // mark the users who need it
  for(let key in lobbies[lobbyId].gameSettings.markedThisTurn){
    let userMarked = lobbies[lobbyId].gameSettings.markedThisTurn[key]
    lobbies[lobbyId].players[userMarked].isMarked = true
  }
  let playerArray = playerMapToArray(lobbies[lobbyId].players)
  io.sockets.in(lobbyId).emit('gameUpdate', {watching: null, marking: null, players: playerArray})
  // reset lists
  lobbies[lobbyId].gameSettings.watchList       = {}
  lobbies[lobbyId].gameSettings.markedThisTurn  = {}
  // did someone win?
  let gameOver = checkWinCondition.call(this, lobbies[lobbyId]['players'], lobbyId)
  if(gameOver){
    for(let key in lobbies[lobbyId].players){
      if(lobbies[lobbyId].players[key].isMarked){
        lobbies[lobbyId].players[key].isDead = true
      }
    }
    let playerArray = playerMapToArray(lobbies[lobbyId].players)
    io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
    endGame.call(this, gameOver, lobbyId)
    return
  }
  // send day message
  lobbies[lobbyId].gameSettings.time            = 'day'
  // reset kill votes
  for(let key in lobbies[lobbyId].players){
    lobbies[lobbyId].players[key].killVote      = null
  }
  // push results to client
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId].gameSettings)
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    if(lobbies[lobbyId].gameSettings.onTrial){
      startTrial.call(this, lobbyId)
      return
    }
    startNight.call(this, lobbyId)
  }, 45000)
  io.sockets.in(lobbyId).emit('setTimer', {timer: 45})
}

// trial is for people to decide if a person is guilty or not
const startTrial = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  // skip if no one is on trial
  if(!lobbies[lobbyId].gameSettings.onTrial){
    startNight.call(this, lobbyId)
  }
  lobbies[lobbyId].gameSettings.time         = 'trial'
  lobbies[lobbyId].gameSettings.messages     = []
  for(let key in lobbies[lobbyId].players){
    lobbies[lobbyId].players[key].trialVote   = null
    lobbies[lobbyId].players[key].voteFor     = null
  }
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId].gameSettings)
  let playerArray = playerMapToArray(lobbies[lobbyId].players)
  io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startNight.call(this, lobbyId)
  }, 30000)
  io.sockets.in(lobbyId).emit('setTimer', {timer: 30})
}

// night is for witches to kill
const startNight = function(lobbyId){
  clearTimeout(lobbies[lobbyId].dayTimer)
  // see if there is a trial going and check for win condition before proceeding
  let playerCount = 0,
    yesCount      = 0
  if(lobbies[lobbyId].gameSettings.onTrial){
    let trialUserId   = lobbies[lobbyId].gameSettings.onTrial.id
    for(let playerId in lobbies[lobbyId]['players']){
      if(!lobbies[lobbyId].players[playerId].isDead){
        playerCount += 1
        if(lobbies[lobbyId].players[playerId].trialVote === 'yes'){
          yesCount += 1
        }
        // reset it once we have the count
        lobbies[lobbyId].players[playerId].trialVote = null
      }
      if(yesCount > (playerCount / 2)){
        lobbies[lobbyId].players[trialUserId].isDead = true
        let playerArray = playerMapToArray(lobbies[lobbyId]['players'])
        io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
        let gameOver = checkWinCondition.call(this, lobbies[lobbyId]['players'], lobbyId)
        if(gameOver){
          endGame.call(this, gameOver, lobbyId)
          return
        }
      }
    }
    lobbies[lobbyId].gameSettings.onTrial = null
  }
  // reset dem killBotes bb
  for(let playerId in lobbies[lobbyId].players){
    lobbies[lobbyId].players[playerId].voteFor  = null
    lobbies[lobbyId].players[playerId].skip     = false
  }
  // send the players back with reset killVotes
  let playerArray = playerMapToArray(lobbies[lobbyId]['players'])
  io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
  // reset the timer
  lobbies[lobbyId].dayTimer = setTimeout(function(){
    startDay.call(this, lobbyId)
  }, 30000)
  lobbies[lobbyId]['gameSettings']['time'] = 'night'
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId]['gameSettings'])
  io.sockets.in(lobbyId).emit('setTimer', {timer: 30})

  // let playerIds       = Object.keys(lobbies[lobbyId].players)
  //   playerCount       = playerIds.length,
  //   audioNoisesLength = audioNoises.length
  // audio isnt allowed on mobile :(
  // lobbies[lobbyId].nightSoundsInterval = setInterval(function(){
  //   let playerId = playerIds[Math.floor(Math.random() * playerCount)],
  //     audioName = audioNoises[Math.floor(Math.random() * audioNoisesLength)]
  //   io.sockets.to(playerId).emit('audio', {fileName: audioName})
  // }, 8000)
  // TODO modify this by player count?

}

const showRole = function(lobbyId){
  for(let playerId in lobbies[lobbyId]['players']){
    let role = lobbies[lobbyId]['players'][playerId]['role']
    io.sockets.to(playerId).emit('notification', {notification: `you are a ${role}`, messageClass: role})
  }
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startDawn.call(this, lobbyId)
  }, 6000)
}

const removeDisconnectedPlayers = function(lobbyId){
  for(let playerId in lobbies[lobbyId].players){
    if(lobbies[lobbyId].players[playerId].disconnected){
      // if the player is not here when the game starts, get rid of them
      delete lobbies[lobbyId].players[playerId]
    }
  }
}

const checkWinCondition = function(playerMap, lobbyId){
  let livingPlayers = 0,
    witches         = 0
  for(let key in playerMap){
    if(!playerMap[key]['isDead'] && !playerMap[key]['isMarked']){
      livingPlayers ++
      if(playerMap[key]['role'] === 'witch'){
        witches ++
      }
    }
  }

  if(witches >= (livingPlayers - witches)){
    if(lobbies[lobbyId]['dayTimer']){
      clearTimeout(lobbies[lobbyId]['dayTimer'])
    }
    return 'witches'
  }
  if(witches === 0){
    if(lobbies[lobbyId]['dayTimer']){
      clearTimeout(lobbies[lobbyId]['dayTimer'])
    }
    return 'villagers'
  }
  return false
}

const endGame = function(winner, lobbyId){
  clearTimeout(lobbies[lobbyId].dayTimer)
  // add a timer for dramatic effect
  lobbies[lobbyId].dayTimer = setTimeout(function(){
    lobbies[lobbyId]['gameSettings'].started = false
    if(winner === 'witches'){
      lobbies[lobbyId].gameSettings.winner = 'witches'
      io.sockets.in(lobbyId).emit('notification', {notification: 'Witches triumph', messageClass: 'witch'})
      io.sockets.in(lobbyId).emit('gameUpdate', {winner: 'witches', started: false, instructions: null})
    } else {
      lobbies[lobbyId].gameSettings.winner = 'villagers'
      io.sockets.in(lobbyId).emit('notification', {notification: 'Villagers defend their homeland', messageClass: 'villager'})
      io.sockets.in(lobbyId).emit('gameUpdate', {winner: 'villagers', started: false, instructions: null})
    }
  }, 3000)
}

io.sockets.on('connection', function(socket) {
  console.log(`a user connected ${socket.id}`)

  socket.on('create', function(ioEvent){
    events.create(ioEvent, socket, lobbies, io);
  })

  socket.on('reconnectClient', function(ioEvent){
    events.reconnect(ioEvent, socket, lobbies, io)
  })

  socket.on('join', function(ioEvent){
    events.join(ioEvent, socket, lobbies, io)
  })

  // TODO rework this so that it reveals at the start of dawn to add supsense
  socket.on('kill', function(ioEvent){
    // RNG
    // let castSucceeded = rng(0.6)
    // if the cast failed send a notification to this socket only
    // if(!castSucceeded){
    //   let username = lobbies[ioEvent.lobbyId]['players'][ioEvent.user].username
    //   lobbies[ioEvent.lobbyId].gameSettings.notification = `${username} was nearly killed.`
      // socket.emit('notification', {notification: `${username} survived`, messageClass: 'failed'})
      // TODO emit to all other users a different wording of this message
      // socket.to(ioEvent.user).emit('notification', {notification: 'you survived', messageClass: 'failed'})
      // lobbies[ioEvent.lobbyId].gameSettings.notification = `${username} was nearly killed.`
      // TODO: add rng flavor here to the attack type depending on village location
      // startDawn.call(this, ioEvent.lobbyId, `${username} was nearly killed.`)
    //   return
    // }
    // lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['isDead'] = true
    lobbies[ioEvent.lobbyId].gameSettings.markedThisTurn[socket.id] = ioEvent.user
    io.sockets.to(socket.id).emit('gameUpdate', {marking: ioEvent.user})
    // let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    // io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
    // check win condition if a player is killed
  })

  socket.on('trialVote', function(ioEvent){
    events.elect(ioEvent, socket, lobbies, io)
  })

  socket.on('submitVote', function(ioEvent){
    events.vote(ioEvent, socket, lobbies, io)
  })

  socket.on('watch', function(ioEvent){
    events.watch(ioEvent, socket, lobbies, io)
  })

  // if the user wants to leave, reset their client state and kill/delete their user
  socket.on('leaveLobby', function(ioEvent){
    events.leave(ioEvent, socket, lobbies, io)
  })

  // this emits a role reveal back to a prophet that requests one
  socket.on('reveal', function(ioEvent, socket, lobbies, startDay){
    events.reveal(socket)
  })

  socket.on('ready', function(ioEvent){
    events.ready(ioEvent, socket, lobbies, io)
  })

  // currently just used for last words when hanging
  socket.on('message', function (ioEvent) {
    events.message(ioEvent, socket, lobbies, io)
  });

  // just typing indicators
  socket.on('typing', function (ioEvent) {
    io.sockets.in(ioEvent.lobbyId).emit('typing', {from: socket.id})
  });

  socket.on('disconnect', function () {
    events.disconnect(socket, lobbies)
  })

})

http.listen(PORT, function () {
  console.log('Witch Hunt is running on ' + PORT)
})