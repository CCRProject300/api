const Pug = require('pug')

module.exports = {
  subject: () => 'You\'ve got KudosCoins!',
  body: Pug.compileFile(`${__dirname}/user-awarded-coins-notification.pug`)
}
