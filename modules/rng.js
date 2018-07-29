/*
  successChance should be a value between 0 and 1
*/
module.exports = function(successChance) {
  return Math.random() <= successChance
}