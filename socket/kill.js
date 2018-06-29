const playerMapToArray = require('../modules/player-map-to-array')
/*

        /| ________________
  O|===|* >________________>
        \|

*/

module.exports = function(ioEvent, socket, lobbies, io){
  if(!lobbies[ioEvent.lobbyId]){
    socket.emit('badToken')
    return
  }
  let oldPlayerRef = lobbies[ioEvent.lobbyId].players[ioEvent.userId]
  // create a new user map with an the new socket.id as it's key/id
  if(!oldPlayerRef){
    socket.emit('badToken')
    return
  }
  socket.join(ioEvent.lobbyId)
  lobbies[ioEvent.lobbyId].players[socket.id]                 = oldPlayerRef
  lobbies[ioEvent.lobbyId].players[socket.id].id              = socket.id
  lobbies[ioEvent.lobbyId].players[socket.id].disconnected    = false
  // delete the old user map
  delete lobbies[ioEvent.lobbyId].players[ioEvent.userId]
  // send the joined event which tells the client to set a session token
  io.sockets.to(socket.id).emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
  // update any vote references to the reconnected players id
  for(let key in lobbies[ioEvent.lobbyId]['players']){
    if(lobbies[ioEvent.lobbyId].players[key].voteFor === ioEvent.userId){
      lobbies[ioEvent.lobbyId].players[key].voteFor = socket.id
    }
    if(lobbies[ioEvent.lobbyId].players[key].trialVote === ioEvent.userId){
      lobbies[ioEvent.lobbyId].players[key].trialVote = socket.id
    }
  }
  // send a gameUpdate event to set their local game state to match the lobby settings
  io.sockets.to(socket.id).emit('gameUpdate', lobbies[ioEvent.lobbyId].gameSettings)
  let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId].players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
}