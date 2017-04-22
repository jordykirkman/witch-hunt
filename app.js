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

app.enable('trust proxy');
app.use(express.static(path.join(__dirname, 'public')));

let lobbies = {}

// day is for people and ghosts to vote
let startDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  io.sockets.in(lobbyId).emit('turn', {instructions: 'Day breaks. The village is uneasy.', time: 'day'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Something stirs in the night.', time: 'night'})
    endDay.call(this, lobbyId)
  }, 60000)
}

// dawn is for prophets to check a role
let startDawn = function(lobbyId){
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
  io.sockets.in(lobbyId).emit('turn', {instructions: 'A prophet gazes into the fire. Who do they see?', time: 'dawn'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Day breaks. The village is uneasy.', time: 'day'})
    startDay.call(this, lobbyId)
  }, 30000)
}

let showRole = function(lobbyId){
  for(let playerId in lobbies[lobbyId]['players']){
    let role = lobbies[lobbyId]['players'][playerId]['role']
    io.sockets.to(playerId).emit('notification', {notification: `you are a ${role}`, messageClass: role})
  }
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    startDawn.call(this, lobbyId, lobbies[lobbyId])
  }, 6000)
}

// night is for whitches to kill
let endDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  for(let playerId in lobbies[lobbyId]['players']){
    lobbies[lobbyId]['players'][playerId]['skip'] = false
  }
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'A prophet gazes into the fire. Who do they see?', time: 'dawn'})
    startDawn.call(this, lobbyId, lobbies[lobbyId])
  }, 30000)
  io.sockets.in(lobbyId).emit('turn', {instructions: "Something stirs in the night", time: 'night'})
}

let assignRoles = function(lobbyId){
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
  io.sockets.in(lobbyId).emit('playerUpdate', {players: playerArray})
}

let checkWinCondition = function(playerMap, lobbyId){
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
let reset = function(lobbyId){
  io.sockets.in(lobbyId).emit('turn', {instructions: 'Day breaks. The village is uneasy.', time: 'day'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Something stirs in the night', time: 'night'})
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
    lobbies[newLobbyId]['players']            = {}
    lobbies[newLobbyId]['players'][socket.id] = freshPlayer
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
    io.sockets.in(newLobbyId).emit('playerUpdate', {players: playerArray})
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
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('join', function(ioEvent){
    socket.join(ioEvent.lobbyId)
    // TODO condence into add player method
    if(!lobbies[ioEvent.lobbyId]){
      socket.emit('error', {error: "Could not find that lobby in the seeing stone."})
      return
    }
    let freshPlayer = new Player(socket.id, false, false, 'villager', false, ioEvent.username)
    lobbies[ioEvent.lobbyId]['players'][socket.id] = freshPlayer
    // send a joined event to that socket only so it sets a token in the client
    socket.emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
    // update all the sockets in this lobby with the latest player list
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('kill', function(ioEvent){
    // RNG
    let castSucceeded = rng(0.67)
    // if the cast failed send a notification to this socket only
    if(!castSucceeded){
      let username = lobbies[ioEvent.lobbyId]['players'][ioEvent.user].name
      socket.emit('notification', {role: `${username} survived`, messageClass: 'failed'})
      socket.to(ioEvent.user).emit('notification', {role: 'you survived', messageClass: 'failed'})
      return
    }
    lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['isDead'] = true
    // check win condition if a player is killed
    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      if(gameOver === 'witches'){
        io.sockets.to(playerId).emit('notification', {notification: 'Witches triumph', messageClass: 'witch'})
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'witches'})
      } else {
        io.sockets.to(playerId).emit('notification', {notification: 'Villagers defend their homeland', messageClass: 'villager'})
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'villagers'})
      }
      return
    }
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
    startDawn.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
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
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})

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
          io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
          endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
        }
      }
    }

    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      if(gameOver === 'witches'){
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'witches'})
      } else {
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'villagers'})
      }
      clearTimeout(lobbies[lobbyId]['dayTimer'])
      return
    }

    // if enough people have skipped to prevent a vote, end the day
    if(skipCount > (playerCount / 2)){
      endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

    // if everyone has voted, end the day
    if(voteCount + skipCount === playerCount){
      endDay.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
      return
    }

  })

  // this emits a role reveal back to a prophet that requests one
  socket.on('reveal', function(ioEvent){
    let role = lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['role']
    clearTimeout(lobbies[ioEvent.lobbyId]['dayTimer'])
    lobbies[ioEvent.lobbyId]['dayTimer'] = setTimeout(function(){
      io.sockets.in(ioEvent.lobbyId).emit('turn', {instructions: 'A new day', time: 'day'})
    }, 4000)
    // emit only to this connected socket, not everyone else
    let castSucceeded = rng(0.67),
      message         = castSucceeded ? role : 'Failed!',
      messageClass    = castSucceeded ? 'success' : 'fail'
    socket.emit('notification', {role: message, messageClass: messageClass})
  })

  socket.on('ready', function(ioEvent){
    io.sockets.in(ioEvent.lobbyId).emit('start')
    assignRoles.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
    showRole.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

  socket.on('disconnect', function () {
    console.log('A user disconnected');
    // set disconnected flag for every lobby the user is in
    for(let room in socket.rooms){
      lobbies[room]['players'][socket.id]['disconnected'] = true
      socket.leave(room)
      // is anyone left in this lobby?
      let lobbyEmpty = true
      for(var playerId in lobbies[room]['players']){
        if(!lobbies[playerId]['players'][playerId]['disconnected']){
          lobbyEmpty = false
        }
        if(lobbyEmpty){
          delete lobbies[playerId]
        }
      }
    }
  })

})

http.listen(80, function () {
  console.log('Witch Hunt is running')
})