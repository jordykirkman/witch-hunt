const nid = require('nid'),
  flavor = ['abandoned', 'ancient', 'forgotten', 'lost', 'misty', 'restless', 'silent'],
  nouns = ['caves', 'bog', 'hills', 'ruins']
// const nouns = ['bog', 'forest', 'hills', 'marshes', 'cliffs']

module.exports = function() {
  const constrainedNid = nid({alphabet: [1,2,3,4,5,6,7,8,9], length:2})
  flavorIndex = Math.round(Math.random() * (flavor.length - 1))
  nounIndex = Math.round(Math.random() * (nouns.length - 1))
  return flavor[flavorIndex] + "-" + nouns[nounIndex] + "-" + constrainedNid()
}