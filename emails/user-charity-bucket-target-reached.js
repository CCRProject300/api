const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth Charity Target Reached!',
  body: Pug.compileFile(`${__dirname}/user-charity-bucket-target-reached.pug`)
}
