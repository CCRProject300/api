const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth Password Reset',
  body: Pug.compileFile(`${__dirname}/user-password-forgot.pug`)
}
