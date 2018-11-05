const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth NEW League',
  body: Pug.compileFile(`${__dirname}/user-added-to-league.pug`)
}
