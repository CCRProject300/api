const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth - This week\'s podium',
  body: Pug.compileFile(`${__dirname}/user-notify-podium-places.pug`)
}
