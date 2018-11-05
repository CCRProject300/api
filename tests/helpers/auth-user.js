const Jwt = require('jsonwebtoken')
const { auth0 } = require('config')

// const secret = auth0.secret
const secret = Buffer.from(auth0.secret, 'Base64')

// For legacy compatibility
module.exports = (db, { email, auth0Id }, cb) => {
  process.nextTick(() => cb(null, getToken({ email, auth0Id })))
}

function getToken ({ email, auth0Id }) {
  const exp = (Date.now() + (1000 * 60 * 60 * 24 * 7)) / 1000
  return Jwt.sign({
    sub: auth0Id,
    aud: auth0.clientId,
    exp
  }, secret, { algorithm: auth0.algorithm })
}

module.exports.getToken = getToken
