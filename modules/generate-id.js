var nid = require('nid')({alphabet: [1,2,3,4,5,6,7,8,9], length:2})

const flavor = ['abandoned', 'ancient', 'crooked', 'forgotten', 'misty', 'restless']
const nouns = ['caves', 'bog']
// const nouns = ['bog', 'forest', 'hills', 'marshes', 'cliffs']

module.exports = function() {
  flavorIndex = Math.round(Math.random() * (flavor.length - 1))
  nounIndex = Math.round(Math.random() * (nouns.length - 1))
  return flavor[flavorIndex] + "-" + nouns[nounIndex] + "-" + nid()
}