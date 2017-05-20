const flavor = ['abandoned', 'ancient', 'crooked', 'forgotten', 'misty', 'restless'],
  nouns = ['caves', 'bog']
// const nouns = ['bog', 'forest', 'hills', 'marshes', 'cliffs']

module.exports = function(nid) {
  flavorIndex = Math.round(Math.random() * (flavor.length - 1))
  nounIndex = Math.round(Math.random() * (nouns.length - 1))
  return flavor[flavorIndex] + "-" + nouns[nounIndex] + "-" + nid()
}