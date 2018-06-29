const Game = require('../classes/game')
const Player = require('../classes/player')
const generateId = require('../modules/generate-id')
const playerMapToArray = require('../modules/player-map-to-array')
const nid = require('nid')
const generateName = require('../modules/generate-name')

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

module.exports = function(ioEvent, socket, lobbies, io){
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
  let freshPlayer = new Player(socket.id, ioEvent.username, 'villager', true),
    players = {}
  players[socket.id] = freshPlayer
  socket.join(newLobbyId)
  lobbies[newLobbyId] = new Game(
    newLobbyId,
    io,
    players
  )

  // lobbies[newLobbyId] = {}
  // add player to lobby
  // lobbies[newLobbyId].players                   = {}
  // lobbies[newLobbyId].players[socket.id]        = freshPlayer
  // lobbies[newLobbyId].gameSettings              = {}
  // lobbies[newLobbyId].gameSettings.witchText    = witchText
  // lobbies[newLobbyId].gameSettings.dayText      = dayText
  // lobbies[newLobbyId].gameSettings.villagerText = villagerText
  // lobbies[newLobbyId].gameSettings.lobbyId      = newLobbyId
  // lobbies[newLobbyId].gameSettings.watchList    = {}
  // lobbies[newLobbyId].gameSettings.messages     = []
  // send them back the lobby id
  socket.emit('gameUpdate', lobbies[newLobbyId].gameSettings)
  // send a joined event to this socket so it creates a session
  socket.emit('joined', {lobbyId: newLobbyId, userId: socket.id})
  // add bots
  if(ioEvent.botCount >= 1){
    for(let n = 0; n <= ioEvent.botCount; n++){
      let botId = nid()
      let botPlayer = new Player(botId, false, false, 'villager', false, generateName())
      lobbies[newLobbyId]['players'][botId] = botPlayer
    }
  }
  // send the player array
  let playerArray = playerMapToArray(lobbies[newLobbyId].players)
  io.sockets.in(newLobbyId).emit('gameUpdate', {players: playerArray})
}