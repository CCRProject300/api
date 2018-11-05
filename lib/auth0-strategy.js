const createAuth0Api = require('../lib/auth0-api')

module.exports = (db, { auth0 }) => {
  const auth0Api = createAuth0Api({ auth0 })
  const key = Buffer.from(auth0.secret, 'Base64')

  return {
    key,

    validateFunc (decoded, req, cb) {
      db.users.findOne({ auth0Id: decoded.sub }, { _id: 1 }, (err, user) => {
        if (err) return cb(err)
        if (decoded.sub && !user) return attemptToCompleteMigration(req.headers.authorization, decoded.sub, cb)
        if (!user) return cb(null, false)

        cb(null, true, user._id)
      })
    },

    verifyOptions: {
      algorithms: [auth0.algorithm],
      audience: auth0.clientId
    }
  }

  function attemptToCompleteMigration (token, auth0Id, cb) {
    auth0Api({
      method: 'POST',
      route: '/tokeninfo',
      json: {
        id_token: token
      },
      noAuth: true
    }, (err, res, body) => {
      if (err || res.statusCode !== 200) return cb(null, false)
      db.users.findAndModify({
        query: { 'emails.address': body.email },
        update: { $set: { auth0Id } }
      }, (err, user) => {
        if (err || !user) return cb(null, false)
        cb(null, true, user._id)
      })
    })
  }
}
