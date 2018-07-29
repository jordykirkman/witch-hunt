const rng = require('../modules/rng')
const lobbies = require('../constants/lobbies')
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

module.exports = function(ioEvent, socket, startDay){
  let game = lobbies[ioEvent.lobbyId]
  let role = game.players[ioEvent.user].role
  // emit only to this connected socket, not everyone else
  let castSucceeded = rng(0.7),
    message         = castSucceeded ? role : 'Failed!',
    messageClass    = castSucceeded ? 'success' : 'fail',
    publicMessage   = castSucceeded ? 'The prophet sees a face in the fire.' : 'The prophet gazes, yet sees nothing.'
  
  for(let playerId in game.players){
    // send the notification if they are the prophet
    if(playerId === socket.id){
      socket.emit('notification', {notification: message, messageClass: messageClass})
    }
    // send the news to everyone
    socket.emit('gameUpdate', {instructions: publicMessage})
  }

  clearTimeout(game.dayTimer)
  game.dayTimer = setTimeout(function(){
    startDay.call(this, ioEvent.lobbyId)
  }, 5000)
}