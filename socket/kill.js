const lobbies = require('../constants/lobbies')
/*

        /| ________________
  O|===|* >________________>
        \|

*/

module.exports = function(ioEvent, io){
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
  lobbies[ioEvent.lobbyId]['players'][ioEvent.user]['isMarked'] = true
  lobbies[ioEvent.lobbyId].gameSettings.markedThisTurn[ioEvent.lobbyId] = ioEvent.user
  if(!ioEvent.lobbyId){
    return
  }
  io.sockets.to(ioEvent.lobbyId).emit('gameUpdate', {marking: ioEvent.user})
  // let playerArray = playerMapToArray(lobbies[ioEvent.lobbyId]['players'])
  // io.sockets.in(ioEvent.lobbyId).emit('gameUpdate', {players: playerArray})
  // check win condition if a player is killed
}