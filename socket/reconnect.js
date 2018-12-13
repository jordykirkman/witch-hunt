const playerMapToArray = require('../modules/player-map-to-array')
const lobbies = require('../constants/lobbies')
/*
  Back again?
  ----------------------------------------------------------
              ,-' ;  ! `-.
              / :  !  :  . \
            |_ ;   __:  ;  |
            )| .  :)(.  !  |
            |"    (##)  _  |
            |  :  ;`'  (_) (
            |  :  :  .     |
            )_ !  ,  ;  ;  |
            || .  .  :  :  |
            |" .  |  :  .  |
            |mt-2_;----.___|
*/

module.exports = function(ioEvent, socket, io){
  let game = lobbies[ioEvent.lobbyId]
  if(!game){
    socket.emit('badToken')
    return
  }
  let oldPlayerRef = game.players[ioEvent.userId]
  // create a new user map with an the new socket.id as it's key/id
  if(!oldPlayerRef){
    socket.emit('badToken')
    return
  }
  socket.join(ioEvent.lobbyId)
  game.players[socket.id]                 = oldPlayerRef
  game.players[socket.id].id              = socket.id
  game.players[socket.id].disconnected    = false
  // delete the old user map
  delete game.players[ioEvent.userId]
  // send the joined event which tells the client to set a session token
  io.sockets.to(socket.id).emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
  // update any vote references to the reconnected players id
  for(let key in game['players']){
    if(game.players[key].voteFor === ioEvent.userId){
      game.players[key].voteFor = socket.id
    }
    if(game.players[key].trialVote === ioEvent.userId){
      game.players[key].trialVote = socket.id
    }
  }
  // send a gameUpdate event to set their local game state to match the lobby settings
  io.sockets.to(socket.id).emit('gameUpdate', game.gameSettings)
  let playerArray = playerMapToArray(game.players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
}