/*
  Poof!
  ----------------------------------------------------------
              (\.   \      ,/)
                \(   |\     )/
                //\  | \   /\\
              (/ /\_#oo#_/\ \)
                \/\  ####  /\/
                    `##'
*/

module.exports = function(socket, lobbies){
  // set disconnected flag for every lobby the user is in
  for(let room in socket.rooms){
    socket.leave(room)
    /*
      is anyone left in this lobby?
      lets set a 30 second timer after a user disconnects to check if a room is empty
      if it's still empty after they have had time to reconnect, delete the room
    */
    if(lobbies[room]){
      // set the users disconnected flag in any lobby they are in
      lobbies[room].players[socket.id].disconnected = true
      setTimeout(function(){
        let lobbyEmpty = true
        for(var playerId in lobbies[room].players){
          if(!lobbies[playerId].players[playerId].disconnected){
            lobbyEmpty = false
          }
        }
        if(lobbyEmpty){
          delete lobbies[room]
        }
      }, 30000)
    }
  }
}