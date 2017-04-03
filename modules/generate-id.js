var nid = require('nid')({length:2})

const flavor = ['abandoned', 'ancient', 'blood', 'crookback', 'forgotten']
const nouns = ['bog', 'forest', 'isle', 'harbor', 'hills', 'marsh', 'moore', 'warren']

module.exports = function() {
  flavorIndex = Math.round(Math.random() * (flavor.length - 1))
  nounIndex = Math.round(Math.random() * (nouns.length - 1))
  return flavor[flavorIndex] + "-" + nouns[nounIndex] + "-" + nid()
}