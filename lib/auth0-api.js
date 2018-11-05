const request = require('request')
const JWT = require('jsonwebtoken')

module.exports = function ({ auth0, auth0Backend }) {
  let token
  let tokenExpiry

  function requestToken (cb) {
    const params = {
      method: 'POST',
      uri: `https://${auth0.domain}/oauth/token`,
      headers: { 'content-type': 'application/json' },
      json: {
        client_id: auth0Backend.clientId,
        client_secret: auth0Backend.secret,
        audience: `https://${auth0.domain}/api/v2/`,
        grant_type: 'client_credentials'
      }
    }

    request(params, (error, res, body) => {
      if (error) return cb(error)

      if (res.statusCode !== 200) {
        console.error('Failed to request token', res.statusCode, body)
        return cb(new Error('Cannot request credentials'))
      }

      token = body.access_token
      tokenExpiry = JWT.decode(token).exp * 1000
      cb()
    })
  }

  return function callApi ({ method = 'GET', route, qs, json = true, noAuth = false }, cb) {
    if (!noAuth && (!token || tokenExpiry < Date.now())) {
      return requestToken((err) => {
        if (err) return cb(err)
        callApi({ method, route, qs, json }, cb)
      })
    }
    const params = {
      method,
      uri: `https://${auth0.domain}${route}`,
      qs,
      json
    }
    if (!noAuth) {
      params.headers = {
        authorization: `Bearer ${token}`
      }
    }

    request(params, cb)
  }
}
