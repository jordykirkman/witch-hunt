/*
  You peer into the glass and see...
               *    .
        '  +   ___    @    .
            .-" __"-.   +
    *      /:.'`__`'.\       '
        . |:: .'_ `. :|   *
   @      |:: '._' : :| .
      +    \:'.__.' :/       '
            /`-...-'\  '   +
   '   .   /         \   .    @
     *     `-.,___,.-'
*/

module.exports = function(ioEvent, socket, lobbies, io){
  const lobby = lobbies[ioEvent.lobbyId]
  if(ioEvent.skip){
    // set vote to null if they skip
    if(lobby.gameSettings.watchList[socket.id] === 'skip'){
      lobby.gameSettings.watchList[socket.id] = null
    } else {
      lobby.gameSettings.watchList[socket.id]= 'skip'
    }
  } else {
    // let them cancel or change a vote
    if(lobby.gameSettings.watchList[socket.id] === ioEvent.user){
      lobby.gameSettings.watchList[socket.id] = null
    } else {
      lobby.gameSettings.watchList[socket.id] = ioEvent.user
    }
  }
  io.sockets.to(socket.id).emit('gameUpdate', {watching: lobby.gameSettings.watchList[socket.id]})
}