const Pug = require('pug')

module.exports = {
  subject: () => 'Rewards have been purchased on KudosHealth',
  body: Pug.compileFile(`${__dirname}/moderator-notify-purchases.pug`)
}
