const names = ['Barron', 'Crone', 'Spikeroog', 'Blandare', 'Carsten']

module.exports = function() {
  let nameIndex = Math.round(Math.random() * (names.length - 1))
  return names[nameIndex]
}