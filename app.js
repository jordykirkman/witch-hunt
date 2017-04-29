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
const PORT              = process.env.PORT || 80

app.enable('trust proxy')
app.use(express.static(path.join(__dirname, '../witch-hunt-client/build')));

let lobbies = {}

// day is for people and ghosts to vote
const startDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  let instructionsMessage = 'Day breaks. The village is uneasy.'
  lobbies[lobbyId]['gameSettings']['time'] = 'day'
  lobbies[lobbyId]['gameSettings']['instructions'] = instructionsMessage
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId]['gameSettings'])
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startNight.call(this, lobbyId)
  }, 60000)
}

// dawn is for prophets to check a role
const startDawn = function(lobbyId, message){
  message = message ? message : ''
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  // no point in dawn if no prophets are alive
  let prophetCount = 0
  for(let playerId in lobbies[lobbyId]['players']){
    let player = lobbies[lobbyId]['players'][playerId]
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
  lobbies[lobbyId]['gameSettings']['time'] = 'dawn'
  lobbies[lobbyId]['gameSettings']['instructions'] = instructionsMessage
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId]['gameSettings'])
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startDay.call(this, lobbyId)
  }, 30000)
}

// night is for whitches to kill
const startNight = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  for(let playerId in lobbies[lobbyId]['players']){
    lobbies[lobbyId]['players'][playerId]['skip'] = false
  }
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startDawn.call(this, lobbyId)
  }, 30000)
  let instructionsMessage = 'Something stirs in the night.'
  lobbies[lobbyId]['gameSettings']['time'] = 'night'
  lobbies[lobbyId]['gameSettings']['instructions'] = instructionsMessage
  io.sockets.in(lobbyId).emit('gameUpdate', lobbies[lobbyId]['gameSettings'])
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

  // reset roles from last game
  for(let key in lobbies[lobbyId]['players']){
    lobbies[lobbyId]['players'][key]['role'] = 'villager'
  }

  while(assignedWitches < desiredWitches){
    assignWitches.call(this)
  }
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

// day is for people and ghosts to vote
const reset = function(lobbyId){
  io.sockets.in(lobbyId).emit('gameUpdate', {instructions: 'Day breaks. The village is uneasy.', time: 'day'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('gameUpdate', {instructions: 'Something stirs in the night', time: 'night'})
  }, 60000)
}

io.sockets.on('connection', function(socket) {
  console.log(`a user connected ${socket.id}`)

  socket.on('create', function(ioEvent){
    const newLobbyId = generateId()
    let freshPlayer = new Player(socket.id, true, false, 'villager', false, ioEvent.username)
    socket.join(newLobbyId)
    lobbies[newLobbyId] = {}
    // add player to lobby
    lobbies[newLobbyId]['players']                  = {}
    lobbies[newLobbyId]['players'][socket.id]       = freshPlayer
    lobbies[newLobbyId]['gameSettings']             = {}
    lobbies[newLobbyId]['gameSettings']['lobbyId']  = newLobbyId
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
    let oldPlayerRef = lobbies[ioEvent.lobbyId]['players'][ioEvent.userId]
    // create a new user map with an the new socket.id as it's key/id
    lobbies[ioEvent.lobbyId]['players'][socket.id]                 = oldPlayerRef
    lobbies[ioEvent.lobbyId]['players'][socket.id]['id']           = socket.id
    lobbies[ioEvent.lobbyId]['players'][socket.id]['disconnected'] = false
    // delete the old user map
    delete lobbies[ioEvent.lobbyId]['players'][ioEvent.userId]
    // send the joined event which tells the client to set a session token
    socket.emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
    // send a gameUpdate event to set their local game state to match the lobby settings
    socket.emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  })

  socket.on('join', function(ioEvent){
    if(lobbies[newLobbyId]['gameSettings'].started){
      socket.emit('error', {error: "That village is pointing fingers and murmering currently. Try again when the monster is gone."})
      return
    }
    // TODO condence into add player method
    if(!lobbies[ioEvent.lobbyId]){
      socket.emit('error', {error: "Could not find that game in the seeing stone."})
      return
    }
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

  socket.on('kill', function(ioEvent){
    // RNG
    let castSucceeded = rng(0.67)
    // if the cast failed send a notification to this socket only
    if(!castSucceeded){
      let username = lobbies[ioEvent.lobbyId]['players'][ioEvent.user].username
      socket.emit('notification', {notification: `${username} survived`, messageClass: 'failed'})
      socket.to(ioEvent.user).emit('notification', {notification: 'you survived', messageClass: 'failed'})
      // TODO: add rng flavor here to the attack type depending on village location
      startDawn.call(this, ioEvent.lobbyId, `${username} was nearly killed. `)
      return
    }
    lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['isDead'] = true
    // check win condition if a player is killed
    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      lobbies[ioEvent.lobbyId]['gameSettings'].started = false
      if(gameOver === 'witches'){
        io.sockets.to(playerId).emit('notification', {notification: 'Witches triumph', messageClass: 'witch'})
        io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'witches', started: false})
      } else {
        io.sockets.to(playerId).emit('notification', {notification: 'Villagers defend their homeland', messageClass: 'villager'})
        io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'villagers', started: false})
      }
      return
    }
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
    startDawn.call(this, ioEvent.lobbyId)
  })

  socket.on('submitVote', function(ioEvent){
    if(ioEvent.skip){
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
    // if there is a majority vote, kill the player
    if(ioEvent.user){
      for(var key in playerVotes){
        if(playerVotes[key] > (playerCount / 2)){
          lobbies[ioEvent.lobbyId]['players'][key]['isDead'] = true
          let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
          io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
          startNight.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
        }
      }
    }

    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      lobbies[ioEvent.lobbyId]['gameSettings'].started = false
      if(gameOver === 'witches'){
        io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'witches', started: false})
      } else {
        io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {winner: 'villagers', started: false})
      }
      clearTimeout(lobbies[lobbyId]['dayTimer'])
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

  // this emits a role reveal back to a prophet that requests one
  socket.on('reveal', function(ioEvent){
    let role = lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['role']
    clearTimeout(lobbies[ioEvent.lobbyId]['dayTimer'])
    lobbies[ioEvent.lobbyId]['dayTimer'] = setTimeout(function(){
      io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {instructions: 'A new day', time: 'day'})
    }, 4000)
    // emit only to this connected socket, not everyone else
    let castSucceeded = rng(0.67),
      message         = castSucceeded ? role : 'Failed!',
      messageClass    = castSucceeded ? 'success' : 'fail'
    socket.emit('notification', {notification: message, messageClass: messageClass})
  })

  socket.on('ready', function(ioEvent){
    lobbies[ioEvent.lobbyId]['gameSettings'].started = true
    lobbies[ioEvent.lobbyId]['gameSettings'].time    = 'dawn'
    lobbies[ioEvent.lobbyId]['gameSettings'].winner  = null
    socket.emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
    assignRoles.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
    showRole.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

  socket.on('disconnect', function () {
    console.log('A user disconnected');
    // set disconnected flag for every lobby the user is in
    for(let room in socket.rooms){
      lobbies[room]['players'][socket.id]['disconnected'] = true
      socket.leave(room)
      /*
        is anyone left in this lobby?
        lets set a 30 second timer after a user disconnects to check if a room is empty
        if it's still empty after they have had time to reconnect, delete the room
      */
      setTimeout(function(){
        let lobbyEmpty = true
        for(var playerId in lobbies[room]['players']){
          if(!lobbies[playerId]['players'][playerId]['disconnected']){
            lobbyEmpty = false
          }
          if(lobbyEmpty){
            delete lobbies[room]
          }
        }
      }, 30000)
    }
  })

})

http.listen(PORT, function () {
  console.log('Witch Hunt is running')
})