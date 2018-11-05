var crypto = require('crypto')

module.exports.encrypt = (text, secret, { algorithm = 'aes-256-ctr' } = {}) => {
  const cipher = crypto.createCipher(algorithm, secret)
  const crypted = cipher.update(text.toString(), 'utf8', 'hex')
  return crypted + cipher.final('hex')
}

module.exports.decrypt = (text, secret, { algorithm = 'aes-256-ctr' } = {}) => {
  const decipher = crypto.createDecipher(algorithm, secret)
  const decrypted = decipher.update(text.toString(), 'hex', 'utf8')
  return decrypted + decipher.final('utf8')
}
