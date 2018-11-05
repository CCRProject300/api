const request = require('request')

const revokeFunctions = {
  // TODO: Fitbit tokens are not currently revoked as they are short-lived and require
  // app Oauth ID and secret, which are not currently available in this repo
  fitbit: (token, cb) => {
    cb()
  },

  'google-fit': (token, cb) => {
    request(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, (err, res) => {
      if (err || res.statusCode !== 200) {
        return cb(err || res.statusMessage || 'Error')
      }
      cb()
    })
  },

  runkeeper: (token, cb) => {
    request.post({
      url: 'https://runkeeper.com/apps/de-authorize',
      form: { access_token: token }
    }, (err, res, body) => {
      if (err || res.statusCode !== 204) {
        return cb(err || res.statusMessage || 'Error')
      }
      cb()
    })
  },

  strava: (token, cb) => {
    request.post({
      url: 'https://www.strava.com/oauth/deauthorize',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (err, res) => {
      if (err || res.statusCode !== 200) {
        return cb(err || res.statusMessage || 'Error')
      }
      cb()
    })
  }
}

module.exports = function (method, token, cb) {
  const revokeFunction = revokeFunctions[method]
  if (!revokeFunction) return cb(new Error(`Method ${method} is not recognised`))
  revokeFunction(token, cb)
}
