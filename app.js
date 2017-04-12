var express = require('express')
var nid = require('nid')
var generateId = require('./modules/generate-id')
var playerMapToArray = require('./modules/player-map-to-array')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
app.use(express.static('../witch-hunt-client/build'))

let lobbies = {}

// day is for people and ghosts to vote
let startDay = function(lobbyId){
  io.sockets.in(lobbyId).emit('turn', {instructions: 'Day breaks', time: 'day'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Something stirs in the night', time: 'night'})
  }, 60000)
}

// dawn is for prophets to check a role
let startDawn = function(lobbyId){
  // no point in dawn if no prophets are alive
  let prophetCount = 0
  for(let key in lobbies[lobbyId]['players']){
    let player = lobbies[lobbyId]['players'][key]
    if(player['role'] === 'prophet' && !player['isDead']){
      prophetCount ++
    }
  }
  // skip dawn if no prophets are alive
  if(prophetCount === 0){
    startDay.call(this, lobbyId)
    return
  }
  io.sockets.in(lobbyId).emit('turn', {instructions: 'Dawn', time: 'dawn'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Day breaks', time: 'day'})
  }, 30000)
}

// night is for whitches to kill
let endDay = function(lobbyId){
  clearTimeout(lobbies[lobbyId]['dayTimer'])
  for(let key in lobbies[lobbyId]['players']){
    lobbies[lobbyId]['players'][key]['skip'] = false
  }
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Dawn', time: 'dawn'})
  }, 90000)
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
  io.sockets.in(lobbyId).emit('turn', {instructions: 'Day breaks', time: 'day'})
  lobbies[lobbyId]['dayTimer'] = setTimeout(function(){
    io.sockets.in(lobbyId).emit('turn', {instructions: 'Something stirs in the night', time: 'night'})
  }, 60000)
}

io.sockets.on('connection', function(socket) {
  console.log(`a user connected ${socket.id}`)

  socket.on('create', function(ioEvent){
    var newLobbyId = generateId()
    socket.join(newLobbyId)
    lobbies[newLobbyId] = {}

    // TODO condence into add player method
    lobbies[newLobbyId]['players']                         = {}
    lobbies[newLobbyId]['players'][socket.id]              = {}
    lobbies[newLobbyId]['players'][socket.id]['username']  = ioEvent.username
    lobbies[newLobbyId]['players'][socket.id]['skip']      = false
    lobbies[newLobbyId]['players'][socket.id]['role']      = 'villager'
    lobbies[newLobbyId]['players'][socket.id]['voteFor']   = null
    lobbies[newLobbyId]['players'][socket.id]['isDead']    = false
    lobbies[newLobbyId]['players'][socket.id]['isCreator'] = true
    lobbies[newLobbyId]['players'][socket.id]['id']        = socket.id
    io.sockets.in(newLobbyId).emit('joined', {lobbyId: newLobbyId, userId: socket.id})
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
    lobbies[ioEvent.lobbyId]['players'][socket.id]       = oldPlayerRef
    lobbies[ioEvent.lobbyId]['players'][socket.id]['id'] = socket.id
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
      return
    }
    lobbies[ioEvent.lobbyId]['players'][socket.id]             = {}
    lobbies[ioEvent.lobbyId]['players'][socket.id]['username'] = ioEvent.username
    lobbies[ioEvent.lobbyId]['players'][socket.id]['skip']     = false
    lobbies[ioEvent.lobbyId]['players'][socket.id]['role']     = 'villager'
    lobbies[ioEvent.lobbyId]['players'][socket.id]['voteFor']  = null
    lobbies[ioEvent.lobbyId]['players'][socket.id]['isDead']   = false
    lobbies[ioEvent.lobbyId]['players'][socket.id]['id']       = socket.id
    io.sockets.in(ioEvent.lobbyId).emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
    let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
    io.sockets.in(ioEvent.lobbyId).emit('playerUpdate', {players: playerArray})
  })

  socket.on('kill', function(ioEvent){
    lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['isDead'] = true

    let gameOver = checkWinCondition.call(this, lobbies[ioEvent.lobbyId]['players'], ioEvent.lobbyId)
    if(gameOver){
      if(gameOver === 'witches'){
        io.sockets.in(ioEvent.lobbyId).emit('end', {winner: 'witches'})
      } else {
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
      if(!lobbies[ioEvent.lobbyId]['players'][key]['isDead']){
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
    // TODO: add RNG here
    socket.emit('revealed', {role: role})
  })

  socket.on('ready', function(ioEvent){
    io.sockets.in(ioEvent.lobbyId).emit('start')
    assignRoles.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
    startDawn.call(this, ioEvent.lobbyId, lobbies[ioEvent.lobbyId])
  })

  socket.on('disconnect', function () {
    console.log('A user disconnected');
    for(let key in socket.rooms){
      lobbies[key]['players'][socket.id]['disconnected'] = true
    }
  });

})

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})