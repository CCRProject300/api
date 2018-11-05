const Pug = require('pug')

module.exports = {
  subject: () => 'KudosHealth Purchase Receipt',
  body: Pug.compileFile(`${__dirname}/user-shop-purchase-receipt.pug`)
}
