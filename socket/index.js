const create    = require('./create')
const join      = require('./join')
const leave      = require('./leave')
const reconnect = require('./reconnect')
const disconnect = require('./disconnect')
const elect = require('./elect')
const kill = require('./kill')
const vote = require('./vote')
const watch = require('./watch')
const message = require('./message')
const ready = require('./ready')
const reveal = require('./reveal')

/*
  You peer into the glass and see...
               *    .
        '  +   ___    @    .
            .-" __"-.   +
    *      /:.'`__`'.\       '
        . |:: .'_ `. :|   *
   @      |:: '._' : :| .
      +    \:'.__.' :/       '
            /`-...-'\  '   +
   '   .   /         \   .    @
     *     `-.,___,.-'
*/

module.exports = {
  create,
  join,
  leave,
  reconnect,
  disconnect,
  elect,
  kill,
  vote,
  watch,
  message,
  ready,
  reveal
};