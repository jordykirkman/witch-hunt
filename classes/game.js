const gameText = require('../constants/game-text')

/*
  Class representing a game lobby
*/

module.exports = class Game {
  constructor(id, io, players) {
    this.id    = id
    this.io    = io
    this.gameSettings = {
      lobbyId:      id,
      witchText:    gameText.witchText,
      dayText:      gameText.dayText,
      villagerText: gameText.villagerText,
      watchList:    {},
      messages:     []
    }
    this.players = players;
  }



  /*
    add a player to this game lobby
  */
  addPlayer(){

  }

  /*
    remove a player from this game lobby
  */
  removePlayer(){

  }

  /*
    remove a player from this game lobby
  */
  startGame(){

  }

  /*
    remove a player from this game lobby
  */
  startDay(){

  }

  /*
    remove a player from this game lobby
  */
  startNight(){

  }
  
}