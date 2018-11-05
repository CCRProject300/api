const nock = require('nock')
const JWT = require('jsonwebtoken')
const { auth0, auth0Backend } = require('config')
const createAuth0Api = require('../../lib/auth0-api')

nock(`https://${auth0.domain}`)
  .patch(/\/api\/v2\/users\/.+/, () => true)
  .twice()
  .reply(200, function (uri, requestBody) {
    return {}
  })

nock(`https://${auth0.domain}`)
  .patch(/\/api\/v2\/users\/.+/, () => true)
  .reply(409)

nock(`https://${auth0.domain}`)
  .persist()
  .patch(/\/api\/v2\/users\/.+/, () => true)
  .reply(200, function (uri, requestBody) {
    return {}
  })

nock(`https://${auth0.domain}`)
  .persist()
  .post('/tokeninfo')
  .reply(200, function (uri, requestBody) {
    const decoded = JWT.decode(requestBody.id_token, { json: true })
    return { user_id: decoded.sub }
  })

nock(`https://${auth0.domain}`)
  .persist()
  .post('/oauth/token')
  .reply(200, function (uri, requestBody) {
    const jwt = JWT.sign({ exp: (Date.now() / 1000) + 1000 }, auth0.secret, { audience: auth0.clientId })
    return { access_token: jwt }
  })

module.exports = createAuth0Api({ auth0, auth0Backend })
