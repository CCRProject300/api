const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth Charity Donation Receipt',
  body: Pug.compileFile(`${__dirname}/user-charity-bucket-donation-receipt.pug`)
}
