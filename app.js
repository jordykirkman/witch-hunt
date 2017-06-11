const express           = require('express')
const path              = require('path')
const nid               = require('nid')
const generateId        = require('./modules/generate-id')
const generateName      = require('./modules/generate-name')
const Player            = require('./modules/player')
const playerMapToArray  = require('./modules/player-map-to-array')
const rng               = require('./modules/rng')
const app               = express()
const http              = require('http').Server(app)
const io                = require('socket.io')(http)
const PORT              = process.env.WITCH_HUNT_PORT || 80
// TODO make a dialogue file
const prophetText       = "Select someone to reveal thier secrets."
const witchText         = "Select who shouldn't live any longer."
const dayText           = "Select someone who is guilty or choose to skip today."
const audioNoises       = ['twig_snap', 'door_creak', 'cup_drop', 'branch_break', 'glass_drop']

app.enable('trust proxy')
app.use(express.static(path.join(__dirname, '../witch-hunt-client/build')))

const lobbies = {}

// day is for people to vote
const startDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  let instructionsMessage                    = 'Day breaks. The village is uneasy.'
  lobbies[lobbyId].gameSettings.time         = 'day'
  lobbies[lobbyId].gameSettings.instructions = instructionsMessage
  for(let key in lobbies[lobbyId].players){
    lobbies[lobbyId].players[key].killVote   = null
  }
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId].gameSettings)
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startTrial.call(this, lobbyId)
  }, 60000)
}

// trial is for people to decide if a person is guilty or not
const startTrial = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  // skip if no one is on trial
  if(!lobbies[ioEvent.lobbyId].gameSettings.onTrial){
    startNight.call(this, lobbyId)
  }
  let instructionsMessage                    = 'Guilty or innocent?'
  lobbies[lobbyId].gameSettings.time         = 'trial'
  lobbies[lobbyId].gameSettings.instructions = instructionsMessage
  for(let key in lobbies[lobbyId].players){
    lobbies[lobbyId].players[key].killVote   = null
  }
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId].gameSettings)
  let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  lobbies[ioEvent.lobbyId].gameSettings.onTrial = null
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startNight.call(this, lobbyId)
  }, 30000)
}

// dawn is for prophets to check a role
const startDawn = function(lobbyId, message){
  // clearInterval(lobbies[lobbyId].nightSoundsInterval)
  message = message ? message : ''
  clearTimeout(lobbies[lobbyId].dayTimer)
  // tell everyone who died
  let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
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

// night is for whitches to kill
const startNight = function(lobbyId){
  clearTimeout(lobbies[lobbyId].dayTimer)
  // see if there is a trial going and check for win condition before proceeding
  let playerCount = 0,
    yesCount      = 0,
    trialUserId   = lobbies[ioEvent.lobbyId].gameSettings.onTrial
  if(trialUserId){
    for(let playerId in lobbies[lobbyId]['players']){
      if(!lobbies[lobbyId].players[playerId].isDead){
        playerCount += 1
        if(lobbies[lobbyId].players[playerId].trialVote){
          yesCount += 1
        }
        // reset it once we have the count
        lobbies[lobbyId].players[playerId].trialVote = false
      }
      if(yesCount >= (playerCount / 2)){
        lobbies[lobbyId].players[trialUserId].isDead = true
        let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
        if(gameOver){
          endGame.call(this, gameOver)
          return
        }
      }
    }
    lobbies[ioEvent.lobbyId].gameSettings.onTrial = null
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
    startDawn.call(this, lobbyId)
  }, 30000)
  let instructionsMessage = 'Something stirs in the night.'
  lobbies[lobbyId]['gameSettings']['time'] = 'night'
  lobbies[lobbyId]['gameSettings']['instructions'] = instructionsMessage
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId]['gameSettings'])

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

const assignRoles = function(lobbyId){
  let playerKeys      = Object.keys(lobbies[lobbyId]['players']),
    playerCount       = playerKeys.length,
    desiredWitches    = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
    desiredProphets   = playerCount / 4 >= 1 ? Math.floor(playerCount / 4) : 1,
    assignedWitches   = 0,
    assignedProphets  = 0,
    assignWitches     = function(){
      let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
        role  = lobbies[lobbyId]['players'][playerKeys[key]]['role']
      if(role === 'witch' || role === 'prophet'){
        assignWitches.call(this)
        return
      }
      assignedWitches ++
      lobbies[lobbyId]['players'][playerKeys[key]]['role'] = 'witch'
    },
    assignProphets    = function(){
      let key = Math.floor(Math.random() * (0 - playerCount)) + playerCount,
        role  = lobbies[lobbyId]['players'][playerKeys[key]]['role']
      if(role === 'witch' || role === 'prophet'){
        assignProphets.call(this)
        return
      }
      assignedProphets ++
      lobbies[lobbyId]['players'][playerKeys[key]]['role'] = 'prophet'
    }

  // reset roles from last game, deaths and votes
  for(let key in lobbies[lobbyId]['players']){
    lobbies[lobbyId].players[key].role      = 'villager'
    lobbies[lobbyId].players[key].isDead    = false
    lobbies[lobbyId].players[key].killVote  = null
  }

  // assign witches
  while(assignedWitches < desiredWitches){
    assignWitches.call(this)
  }
  // assign vilagers
  while(assignedProphets < desiredProphets){
    assignProphets.call(this)
  }

  let playerArray = playerMapToArray(lobbies[lobbyId]['players'])
  io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
}

const checkWinCondition = function(playerMap, lobbyId){
  let livingPlayers = 0,
    witches         = 0
  for(let key in playerMap){
    if(!playerMap[key]['isDead']){
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

const endGame = function(winner){
  lobbies[ioEvent.lobbyId]['gameSettings'].started = false
  if(winner === 'witches'){
    lobbies[ioEvent.lobbyId].gameSettings.winner = 'witches'
    io.sockets.in(ioEvent.lobbyId).emit('notification', {notification: 'Witches triumph', messageClass: 'witch'})
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'witches', started: false, instructions: null})
  } else {
    lobbies[ioEvent.lobbyId].gameSettings.winner = 'villagers'
    io.sockets.in(ioEvent.lobbyId).emit('notification', {notification: 'Villagers defend their homeland', messageClass: 'villager'})
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'villagers', started: false, instructions: null})
  }
}

io.sockets.on('connection', function(socket) {
  console.log(`a user connected ${socket.id}`)

  socket.on('create', function(ioEvent){
    const newLobbyId = generateId()
    console.log("socket id on create" + socket.id)
    let freshPlayer = new Player(socket.id, true, false, 'villager', false, ioEvent.username)
    socket.join(newLobbyId)
    lobbies[newLobbyId] = {}
    // add player to lobby
    lobbies[newLobbyId].players                   = {}
    lobbies[newLobbyId].players[socket.id]        = freshPlayer
    lobbies[newLobbyId].gameSettings              = {}
    lobbies[newLobbyId].gameSettings.prophetText  = prophetText
    lobbies[newLobbyId].gameSettings.witchText    = witchText
    lobbies[newLobbyId].gameSettings.dayText      = dayText
    lobbies[newLobbyId].gameSettings.lobbyId      = newLobbyId
    // send them back the lobby id
    socket.emit('gameUpdate', lobbies[newLobbyId].gameSettings)
    // send a joined event to this socket so it creates a session
    socket.emit('joined', {lobbyId: newLobbyId, userId: socket.id})
    // add bots
    if(ioEvent.botCount >= 1){
      for(let n = 0; n <= ioEvent.botCount; n++){
        let botId = nid()
        let botName = generateName()
        let botPlayer = new Player(botId, false, false, 'villager', false, generateName())
        lobbies[newLobbyId]['players'][botId] = botPlayer
      }
    }
    // send the player array
    let playerArray = playerMapToArray(lobbies[newLobbyId]['players'])
    io.sockets.in(newLobbyId).emit('gameUpdate', {players: playerArray})
  })

  socket.on('reconnectClient', function(ioEvent){
    if(!lobbies[ioEvent.lobbyId]){
      return
    }
    socket.join(ioEvent.lobbyId)
    let oldPlayerRef = lobbies[ioEvent.lobbyId].players[ioEvent.userId]
    // create a new user map with an the new socket.id as it's key/id
    console.log("old player ref", oldPlayerRef)
    if(!oldPlayerRef){
      return
    }
    lobbies[ioEvent.lobbyId].players[socket.id]                 = oldPlayerRef
    lobbies[ioEvent.lobbyId].players[socket.id].id              = socket.id
    lobbies[ioEvent.lobbyId].players[socket.id].disconnected    = false
    // delete the old user map
    delete lobbies[ioEvent.lobbyId].players[ioEvent.userId]
    // send the joined event which tells the client to set a session token
    socket.emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
    // send a gameUpdate event to set their local game state to match the lobby settings
    socket.emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  })

  socket.on('join', function(ioEvent){
    // is there a lobby?
    if(!lobbies[ioEvent.lobbyId]){
      socket.emit('errorResponse', {error: "Could not find that village in the seeing stone."})
      return
    }
    // has it started?
    if(lobbies[ioEvent.lobbyId].gameSettings.started){
      socket.emit('errorResponse', {error: "That village is pointing fingers and murmering currently. Try again when the monster is gone."})
      return
    }
    // is their name taken?
    let nameTaken = false
    for(playerId in lobbies[ioEvent.lobbyId].players){
      if(lobbies[ioEvent.lobbyId].players[playerId] === ioEvent.username){
        nameTaken = true
      }
    }
    if(nameTaken){
      socket.emit('errorResponse', {error: "There is already a villager here by that name. Are you called something else?"})
      return
    }

    // TODO condence into add player method
    socket.join(ioEvent.lobbyId)
    let freshPlayer = new Player(socket.id, false, false, 'villager', false, ioEvent.username)
    lobbies[ioEvent.lobbyId]['players'][socket.id] = freshPlayer
    // send a joined event to that socket only so it sets a token in the client
    socket.emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
    socket.emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
    // update all the sockets in this lobby with the latest player list
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  })

  // TODO rework this so that it reveals at the start of dawn to add supsense
  socket.on('kill', function(ioEvent){
    // RNG
    let castSucceeded = rng(0.6)
    // if the cast failed send a notification to this socket only
    if(!castSucceeded){
      let username = lobbies[ioEvent.lobbyId]['players'][ioEvent.user].username
      lobbies[ioEvent.lobbyId].gameSettings.notification = `${username} was nearly killed.`
      // socket.emit('notification', {notification: `${username} survived`, messageClass: 'failed'})
      // TODO emit to all other users a different wording of this message
      // socket.to(ioEvent.user).emit('notification', {notification: 'you survived', messageClass: 'failed'})
      // lobbies[ioEvent.lobbyId].gameSettings.notification = `${username} was nearly killed.`
      // TODO: add rng flavor here to the attack type depending on village location
      // startDawn.call(this, ioEvent.lobbyId, `${username} was nearly killed.`)
      return
    }
    lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['isDead'] = true
    // check win condition if a player is killed
    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      endGame.call(this, gameOver)
    }
  })

  socket.on('trialVote', function(ioEvent){
    if(lobbies[ioEvent.lobbyId].players[ioEvent.from].isDead){
      return
    }
    lobbies[ioEvent.lobbyId].players[ioEvent.from].trialVote = ioEvent.trialVote
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  })

  socket.on('submitVote', function(ioEvent){
    if(ioEvent.skip){
      if(lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['isDead']){
        return;
      }
      // set vote to null if they skip
      lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['voteFor'] = null
      if(lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['skip']){
        lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['skip'] = false
      } else {
        lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['skip'] = true
      }
    } else {
      // set skip to false if they cast a vote
      lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['skip'] = false
      if(lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['voteFor'] === ioEvent.user){
        lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['voteFor'] = null
      } else {
        lobbies[ioEvent.lobbyId]['players'][ioEvent.from]['voteFor'] = ioEvent.user
      }
    }

    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})

    // count our alive players
    let playerCount = 0,
      playerVotes   = {},
      voteCount     = 0,
      skipCount     = 0
    for(let key in lobbies[ioEvent.lobbyId]['players']){
      if(!lobbies[ioEvent.lobbyId]['players'][key]['isDead'] && !lobbies[ioEvent.lobbyId]['players'][key]['disconnected']){
        playerCount ++
        if(lobbies[ioEvent.lobbyId]['players'][key]['voteFor']){
          // add the player id being voted for as a key in playerVotes
          if(playerVotes[lobbies[ioEvent.lobbyId]['players'][key]['voteFor']]){
            playerVotes[lobbies[ioEvent.lobbyId]['players'][key]['voteFor']] ++
          } else {
            playerVotes[lobbies[ioEvent.lobbyId]['players'][key]['voteFor']] = 1
          }
        }
      }

      if(ioEvent.skip){
        skipCount += lobbies[ioEvent.lobbyId]['players'][key]['skip'] ? 1 : 0
      }
    }
    // if there is a majority vote, put the player on trial or kill them
    if(ioEvent.user){
      for(var playerId in playerVotes){
        // is there a player id with greater than 50% of the votes?
        if(playerVotes[playerId] > (playerCount / 2)){
          lobbies[ioEvent.lobbyId].gameSettings.onTrial = playerId
        }
      }
    }

    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      lobbies[ioEvent.lobbyId]['gameSettings'].started = false
      if(gameOver === 'witches'){
        lobbies[ioEvent.lobbyId].gameSettings.winner = 'witches'
        io.sockets.in(ioEvent.lobbyId).emit('notification', {notification: 'Witches triumph', messageClass: 'witch'})
        io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'witches', started: false, instructions: null})
      } else {
        lobbies[ioEvent.lobbyId].gameSettings.winner = 'villagers'
        io.sockets.in(ioEvent.lobbyId).emit('notification', {notification: 'Villagers defend their homeland', messageClass: 'villages'})
        io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'villagers', started: false, instructions: null})
      }
      clearTimeout(lobbies[ioEvent.lobbyId]['dayTimer'])
      return
    }

    // if enough people have skipped to prevent a vote, end the day
    if(skipCount > (playerCount / 2)){
      startNight.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

    // if everyone has voted, end the day
    if(voteCount + skipCount === playerCount){
      startNight.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

  })

  // if the user wants to leave, reset their client state and kill/delete their user
  socket.on('leaveLobby', function(ioEvent){
    if(!lobbies[ioEvent.lobbyId]){
      return
    }
    socket.emit('gameUpdate', {
      user:               {},
      lobbyId:            '',
      joinLobbyId:        '',
      instructions:       null,
      playerNotification: null,
      showNotification:   false,
      notificationClass:  '',
      players:            [],
      create:             true,
      started:            false,
      winner:             null,
      time:               'night'
    })
    // if the lobby is empty delete it
    if(Object.keys(lobbies[ioEvent.lobbyId].players).length === 1){
      delete lobbies[ioEvent.lobbyId]
      return
    } else {
      if(lobbies[ioEvent.lobbyId].players[socket.id]){
        // otherwise kill their player in this game
        if(lobbies[ioEvent.lobbyId].gameSettings.started){
          lobbies[ioEvent.lobbyId].players[socket.id].isDead       = true
          lobbies[ioEvent.lobbyId].players[socket.id].disconnected = true
        } else {
          // the game is not started so just get rid of the player
          delete lobbies[ioEvent.lobbyId].players[socket.id]
        }
      }
      // and leave the room
      socket.leave(ioEvent.lobbyId)
      // check if there are any connected clients in the lobby
      let lobbyEmpty = true
      for(var playerId in lobbies[room].players){
        if(!lobbies[playerId].players[playerId].disconnected){
          lobbyEmpty = false
        }
      }
      if(lobbyEmpty){
        delete lobbies[ioEvent.lobbyId]
        return
      }
      // update remaining clients
      let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
      io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
    }
  })

  // this emits a role reveal back to a prophet that requests one
  socket.on('reveal', function(ioEvent){
    self = this
    let role = lobbies[ioEvent.lobbyId].players[ioEvent.user].role
    // emit only to this connected socket, not everyone else
    let castSucceeded = rng(0.7),
      message         = castSucceeded ? role : 'Failed!',
      messageClass    = castSucceeded ? 'success' : 'fail',
      publicMessage   = castSucceeded ? 'The prophet sees a face in the fire.' : 'The prophet gazes, yet sees nothing.';
    
    for(playerId in lobbies[ioEvent.lobbyId].players){
      // send the notification if they are the prophet
      if(playerId === socket.id){
        socket.emit('notification', {notification: message, messageClass: messageClass})
      }
      // send the news to everyone
      socket.emit('gameUpdate', {instructions: publicMessage})
    }
  })

  socket.on('ready', function(ioEvent){
    lobbies[ioEvent.lobbyId].gameSettings.started = true
    lobbies[ioEvent.lobbyId].gameSettings.time    = 'dawn'
    lobbies[ioEvent.lobbyId].gameSettings.winner  = null
    lobbies[ioEvent.lobbyId].gameSettings.onTrial = null
    // reset votes
    for(let playerId in lobbies[lobbyId].players){
      lobbies[lobbyId].players[playerId].voteFor    = null
      lobbies[lobbyId].players[playerId].trialVote  = null
      lobbies[lobbyId].players[playerId].skip       = false
    }
    // send the players back with reset killVotes
    let playerArray = playerMapToArray(lobbies[lobbyId]['players'])
    io.sockets.in(lobbyId).emit('gameUpdate', {players: playerArray})
    // send the reset game settings
    socket.emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
    removeDisconnectedPlayers.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
    assignRoles.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
    showRole.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

  socket.on('disconnect', function () {
    console.log('A user disconnected');
    // set disconnected flag for every lobby the user is in
    for(let room in socket.rooms){
      socket.leave(room)
      /*
        is anyone left in this lobby?
        lets set a 30 second timer after a user disconnects to check if a room is empty
        if it's still empty after they have had time to reconnect, delete the room
      */
      if(lobbies[room]){
        // set the users disconnected flag in any lobby they are in
        lobbies[room].players[socket.id].disconnected = true
        setTimeout(function(){
          let lobbyEmpty = true
          for(var playerId in lobbies[room].players){
            if(!lobbies[playerId].players[playerId].disconnected){
              lobbyEmpty = false
            }
          }
          if(lobbyEmpty){
            delete lobbies[room]
          }
        }, 30000)
      }
    }
  })

})

http.listen(PORT, function () {
  console.log('Witch Hunt is running on ' + PORT)
})