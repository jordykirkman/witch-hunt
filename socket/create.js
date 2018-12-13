const Game = require('../classes/game')
const Player = require('../classes/player')
const Ai = require('../classes/ai')
const generateId = require('../modules/generate-id')
const playerMapToArray = require('../modules/player-map-to-array')
const nid = require('nid')
const generateName = require('../modules/generate-name')
const lobbies = require('../constants/lobbies')
const elect = require('../socket/elect')
const vote = require('../socket/vote')
const kill = require('../socket/kill')

/*
  With a flick of your wrist, a new game appears before you.
  ----------------------------------------------------------
                             /\
                            /  \
                           |    |
                         --:'''':--
                           :'_' :
                           _:"":\___
            ' '      ____.' :::     '._
           . *=====<<=)           \    :
            .  '      '-'-'\_      /'._.'
                             \====:_ ""
                            .'     \\
                           :       :
                          /   :    \
                         :   .      '.
         ,. _        snd :  : :      :
      '-'    ).          :__:-:__.;--'
    (        '  )        '-'   '-'
 ( -   .00.   - _
(    .'  _ )     )
'-  ()_.\,\,   -
  ----------------------------------------------------------
  -art credit: Shanaka Dias
*/

module.exports = function(ioEvent, socket, io){
  // no blank names
  if(!ioEvent.username){
    socket.emit('errorResponse', {error: 'But what should we call ye?'})
    return
  }
  // name length cap
  if(ioEvent.username.length >= 20){
    socket.emit('errorResponse', {error: 'We are a simple village and your name is complicated. Try something shorter.'})
    return
  }
  const newLobbyId = generateId()
  let freshPlayer = new Player(
      newLobbyId,
      socket.id,
      ioEvent.username,
      'villager',
      true
    ),
    players = {}
  players[socket.id] = freshPlayer
  socket.join(newLobbyId)
  lobbies[newLobbyId] = new Game(
    newLobbyId,
    io,
    players
  )
  socket.emit('gameUpdate', lobbies[newLobbyId].gameSettings)
  // send a joined event to this socket so it creates a session
  socket.emit('joined', {lobbyId: newLobbyId, userId: socket.id})
  // add bots
  if(ioEvent.botCount >= 1){
    for(let n = 0; n <= ioEvent.botCount; n++){
      let id = nid()
      // gameId, id, username, role, isCreator, ai, isDead, skip, voteFor, isMarked, events
      let botPlayer = new Ai(
        newLobbyId,
        id,
        generateName(),
        'villager',
        false,
        true,
        null,
        null,
        null,
        null,
        elect,
        io,
        vote,
        kill
      )
      lobbies[newLobbyId].players[id] = botPlayer
    }
  }
  // send the player array
  let playerArray = playerMapToArray(lobbies[newLobbyId].players)
  io.sockets.in(newLobbyId).emit('gameUpdate', {players: playerArray})
}