const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth - You have been added to a League',
  body: Pug.compileFile(`${__dirname}/user-joined-a-league.pug`)
}
