const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth monthly statistics',
  body: Pug.compileFile(`${__dirname}/moderator-monthly-stats.pug`)
}
