const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth league changes!',
  body: Pug.compileFile(`${__dirname}/user-notify-leaderboard-update.pug`)
}
