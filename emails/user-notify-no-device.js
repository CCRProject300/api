const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth Connect a Device',
  body: Pug.compileFile(`${__dirname}/user-notify-no-device.pug`)
}
