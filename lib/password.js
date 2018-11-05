const Bcrypt = require('bcrypt-nodejs')
const SALT_WORK_FACTOR = 8

module.exports.hash = (pass, cb) => {
  Bcrypt.genSalt(SALT_WORK_FACTOR, (err, salt) => {
    if (err) return cb(err)
    Bcrypt.hash(pass, salt, null, (err, hash) => cb(err, hash))
  })
}

module.exports.compare = Bcrypt.compare
