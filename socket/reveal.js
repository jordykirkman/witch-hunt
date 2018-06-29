const rng = require('../modules/rng')
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

module.exports = function(ioEvent, socket, lobbies, startDay){
  let role = lobbies[ioEvent.lobbyId].players[ioEvent.user].role
  // emit only to this connected socket, not everyone else
  let castSucceeded = rng(0.7),
    message         = castSucceeded ? role : 'Failed!',
    messageClass    = castSucceeded ? 'success' : 'fail',
    publicMessage   = castSucceeded ? 'The prophet sees a face in the fire.' : 'The prophet gazes, yet sees nothing.'
  
  for(let playerId in lobbies[ioEvent.lobbyId].players){
    // send the notification if they are the prophet
    if(playerId === socket.id){
      socket.emit('notification', {notification: message, messageClass: messageClass})
    }
    // send the news to everyone
    socket.emit('gameUpdate', {instructions: publicMessage})
  }

  clearTimeout(lobbies[ioEvent.lobbyId].dayTimer)
  lobbies[ioEvent.lobbyId].dayTimer = setTimeout(function(){
    startDay.call(this, ioEvent.lobbyId)
  }, 5000)
}