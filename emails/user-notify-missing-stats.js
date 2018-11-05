const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth Complete your Profile',
  body: Pug.compileFile(`${__dirname}/user-notify-missing-stats.pug`)
}
