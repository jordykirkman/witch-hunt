const playerMapToArray = require('../modules/player-map-to-array')
const Player = require('../classes/player')
const lobbies = require('../constants/lobbies')
/*
  You may enter.
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
  // no blank names
  if(!ioEvent.username){
    socket.emit('errorResponse', {error: 'But what should we call ye?'})
    return
  }
  // is there a lobby?
  if(!game){
    socket.emit('errorResponse', {error: 'Could not find that village.'})
    return
  }
  // has it started?
  if(game.gameSettings.started){
    socket.emit('errorResponse', {error: 'That village is in a game. Join when it\'s done.'})
    return
  }
  // is their name taken?
  let nameTaken = false
  for(let playerId in game.players){
    if(game.players[playerId] === ioEvent.username){
      nameTaken = true
    }
  }
  if(nameTaken){
    socket.emit('errorResponse', {error: 'There is already a villager here by that name. Are you called something else?'})
    return
  }
  // name length cap
  if(ioEvent.username.length >= 20){
    socket.emit('errorResponse', {error: 'We are a simple village and your name is complicated. Try something shorter.'})
    return
  }

  // TODO condence into add player method
  socket.join(ioEvent.lobbyId)
  let freshPlayer = new Player(socket.id, ioEvent.username, 'villager')
  game.addPlayer(freshPlayer)
  // send a joined event to that socket only so it sets a token in the client
  socket.emit('joined', {lobbyId: ioEvent.lobbyId, userId: socket.id})
  socket.emit('gameUpdate', game.gameSettings)
  // update all the sockets in this lobby with the latest player list
  let playerArray = playerMapToArray(game.players)
  io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
}