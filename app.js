var express = require('express')
var nid = require('nid')
var app = express()

var openLobbies = {}

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.get('/new-game', function (req, res) {
  var newPartyId = nid()
  openLobbies[newPartyId] = {}
  res.send(`party: ${newPartyId}`)
})

app.get('/:id', function (req, res) {
  var partyId = req.params.id;
  var lobby = openLobbies[partyId]
  if(!lobby['players']){
    lobby['players'] = []
  }
  var playerNumber = lobby['players'].length + 1;
  lobby['players'].push({})
  res.send(`you are player #${playerNumber}`)
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})