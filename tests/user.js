const test = require('tape')
const Request = require('request')
const Async = require('async')
const Jwt = require('jsonwebtoken')
const config = require('config')
const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const authUser = require('./helpers/auth-user')
const fakeUserPayload = require('./helpers/fake-user-payload')
const fakeCompanyPayload = require('./helpers/fake-company-payload')

let serverUrl = null
let db = null

test('Start server', (t) => {
  t.plan(1)
  Server.start((err, ctx) => {
    t.ifError(err, 'Server started successfully')
    serverUrl = ctx.server.info.uri
    db = ctx.db
    t.end()
  })
})

test('Should be able to get my user details whilst logged in', (t) => {
  t.plan(3)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => cb(err, { token, user }))
    },
    function getUserDetails ({ token, user }, cb) {
      Request.get({
        url: `${serverUrl}/user`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { res, body, user }))
    },
    function verifyResponse ({ res, body, user }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(body.firstName, user.firstName, 'Returned firstName is correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to register', (t) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function login (cb) {
      const user = fakeUserPayload({
        auth0Id: Faker.internet.password()
      })
      authUser(serverUrl, { email: user.email, auth0Id: user.auth0Id }, (err, token) => cb(err, { token, user }))
    },
    function register ({ token, user }, cb) {
      Request.post({
        url: `${serverUrl}/user`,
        json: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        headers: {
          Authorization: token
        }
      }, (err, res) => cb(err, { res, user }))
    },
    function verifyResponse ({ res, user }, cb) {
      t.equal(res.statusCode, 201, 'Status code is 201')
      t.ok(Jwt.verify(res.headers.authorization, Buffer.from(config.auth0.secret, 'Base64'), { audience: config.auth0.clientId }), 'JWT verifies OK')
      t.equal(Jwt.decode(res.headers.authorization, config.auth0.clientId).sub, user.auth0Id, 'JWT has user')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to register if email is taken', (t) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb), // Create an existing user to clash with
    function login (user, cb) {
      const userData = fakeUserPayload({
        auth0Id: Faker.internet.password(),
        email: user.emails[0].address
      })
      authUser(serverUrl, { email: userData.email, auth0Id: user.auth0Id }, (err, token) => cb(err, { token, newUser: userData }))
    },
    function attemptRegister ({ newUser, token }, cb) {
      Request.post({
        url: `${serverUrl}/user`,
        json: {
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email
        },
        headers: {
          Authorization: token
        }
      }, (err, res) => cb(err, res))
    },
    function verifyResponse (res, cb) {
      t.equal(res.statusCode, 409, 'Status code is 409')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to update password', (t) => {
  t.plan(2)

  const newPassword = `test${Date.now()}`

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => cb(err, { token, user }))
    },
    function updatePassword ({ token, user }, cb) {
      Request.patch({
        url: `${serverUrl}/user`,
        json: { password: newPassword },
        headers: { authorization: token }
      }, (err, res) => cb(err, { res, user }))
    },
    function verifyResponse ({ res, user }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb(null, user)
    },
    function loginWithNewPassword (user, cb) {
      authUser(serverUrl, {email: user.authData.email, password: newPassword}, cb)
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to update email', (t) => {
  t.plan(3)

  const newEmail = `test${Date.now()}@example.org`

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => cb(err, { token, user }))
    },
    function updateEmail ({ token, user }, cb) {
      Request.patch({
        url: `${serverUrl}/user`,
        json: { email: newEmail },
        headers: { authorization: token }
      }, (err, res) => cb(err, { res, user, token }))
    },
    function verifyResponse ({ res, user, token }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb(null, { user, token })
    },
    function getUserDetails ({ user, token }, cb) {
      Request.get({
        url: `${serverUrl}/user`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { res, body }))
    },
    function verifyResponse ({ res, body }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to update email if already taken', (t) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createExistingUser (cb) {
      addUser(db, cb)
    },
    function addTestUser (existingUser, cb) {
      addUser(db, (err, user) => cb(err, { user, existingUser }))
    },
    function login ({ user, existingUser }, cb) {
      authUser(serverUrl, { email: user.emails[0].address, auth0Id: user.authData.auth0Id }, (err, token) => cb(err, { token, user, existingUser }))
    },
    function updateEmail ({ token, user, existingUser }, cb) {
      Request.patch({
        url: `${serverUrl}/user`,
        json: { email: existingUser.emails[0].address },
        headers: { authorization: token }
      }, (err, res) => cb(err, res))
    },
    function verifyResponse (res, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to update default email', (t) => {
  t.plan(5)

  const newEmail1 = `test${Date.now()}1@example.org`
  const newEmail2 = `test${Date.now()}2@example.org`

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => cb(err, { token, user }))
    },
    function updateEmail1 ({ token, user }, cb) {
      Request.patch({
        url: `${serverUrl}/user`,
        json: { email: newEmail1 },
        headers: { authorization: token }
      }, (err, res) => cb(err, { res, user, token }))
    },
    function verifyResponse ({ res, user, token }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb(null, { token, user })
    },
    function updateEmail2 ({ token, user }, cb) {
      Request.patch({
        url: `${serverUrl}/user`,
        json: { email: newEmail2 },
        headers: { authorization: token }
      }, (err, res) => cb(err, { res, user, token }))
    },
    function verifyResponse ({ res, user, token }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb(null, { token, user })
    },
    function updateBackToEmail1 ({ token, user }, cb) {
      Request.patch({
        url: `${serverUrl}/user`,
        json: { email: newEmail1 },
        headers: { authorization: token }
      }, (err, res) => cb(err, { res, user, token }))
    },
    function getUserDetails ({ res, user, token }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')

      Request.get({
        url: `${serverUrl}/user`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { res, body }))
    },
    function verifyResponse ({ res, body }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to register with invite token', (t) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, jwt) => cb(err, { jwt, user }))
    },
    function makeCompany ({ jwt, user }, cb) {
      const company = fakeCompanyPayload({
        startDate: Faker.date.past(),
        endDate: Faker.date.future(),
        moderators: [{
          user: user._id,
          startDate: Faker.date.recent(),
          endDate: Faker.date.future(),
          active: true,
          activated: true
        }],
        members: [],
        deleted: false,
        leagues: [],
        roles: ['roleA', 'roleB']
      })
      db.companies.insert(company, (err, company) => cb(err, { jwt, user, company }))
    },
    function makeUserCorporateMod ({ jwt, user, company }, cb) {
      db.users.update({ _id: user._id }, { $set: { roles: ['corporate_mod'] } }, (err) => cb(err, { jwt, company }))
    },
    function makeToken ({ jwt, company }, cb) {
      Request.post({
        url: `${serverUrl}/company/${company._id.toString()}/token`,
        headers: { authorization: jwt },
        json: true
      }, (err, res, { token }) => cb(err, { company, token }))
    },
    function auth0Signup ({ company, token }, cb) {
      const user = fakeUserPayload({
        auth0Id: Faker.internet.password()
      })
      authUser(serverUrl, { email: user.email, auth0Id: user.auth0Id }, (err, jwt) => cb(err, { jwt, user, company, token }))
    },
    function register ({ jwt, user, company, token }, cb) {
      Request.post({
        url: `${serverUrl}/user?token=${token}`,
        json: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        headers: {
          Authorization: jwt
        }
      }, (err, res, body) => cb(err, { res, body, company }))
    },
    function verifyUserCompany ({ res, body, company }, cb) {
      t.equal(res.statusCode, 201, 'Status code is 201')
      t.equal(body.companyName, company.name, 'User\'s company name is correct')
      t.deepEqual(body.roles, ['user', 'roleA', 'roleB'], 'Company roles are propagated to user doc')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to register with revoked invite token', (t) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, jwt) => cb(err, { jwt, user }))
    },
    function makeCompany ({ jwt, user }, cb) {
      const company = fakeCompanyPayload({
        startDate: Faker.date.past(),
        endDate: Faker.date.future(),
        moderators: [{
          user: user._id,
          startDate: Faker.date.recent(),
          endDate: Faker.date.future(),
          active: true,
          activated: true
        }],
        members: [],
        deleted: false,
        leagues: []
      })
      db.companies.insert(company, (err, company) => cb(err, { jwt, user, company }))
    },
    function makeUserCorporateMod ({ jwt, user, company }, cb) {
      db.users.update({ _id: user._id }, { $set: { roles: ['corporate_mod'] } }, (err) => cb(err, { jwt, company }))
    },
    function makeToken ({ jwt, company }, cb) {
      Request.post({
        url: `${serverUrl}/company/${company._id.toString()}/token`,
        headers: { authorization: jwt },
        json: true
      }, (err, res, { token }) => cb(err, { jwt, company, token }))
    },
    function revokeToken ({ jwt, company, token }, cb) {
      Request.patch({
        url: `${serverUrl}/company/${company._id.toString()}/token/${token}`,
        headers: { authorization: jwt }
      }, (err) => cb(err, { company, token }))
    },
    function auth0Signup ({ company, token }, cb) {
      const user = fakeUserPayload({
        auth0Id: Faker.internet.password()
      })
      authUser(serverUrl, { email: user.email, auth0Id: user.auth0Id }, (err, jwt) => cb(err, { jwt, user, company, token }))
    },
    function register ({ jwt, user, company, token }, cb) {
      Request.post({
        url: `${serverUrl}/user?token=${token}`,
        json: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        headers: {
          Authorization: jwt
        }
      }, (err, res, body) => cb(err, { res, body, company }))
    },
    function verifyUserCompany ({ res, body, company }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to revoke an invite token', (t) => {
  t.plan(3)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, jwt) => cb(err, { jwt, user }))
    },
    function makeCompany ({ jwt, user }, cb) {
      const company = fakeCompanyPayload({
        startDate: Faker.date.past(),
        endDate: Faker.date.future(),
        moderators: [{
          user: user._id,
          startDate: Faker.date.recent(),
          endDate: Faker.date.future(),
          active: true,
          activated: true
        }],
        members: [],
        deleted: false,
        leagues: []
      })
      db.companies.insert(company, (err, company) => cb(err, { jwt, user, company }))
    },
    function makeUserCorporateMod ({ jwt, user, company }, cb) {
      db.users.update({ _id: user._id }, { $set: { roles: ['corporate_mod'] } }, (err) => cb(err, { jwt, company }))
    },
    function makeToken ({ jwt, company }, cb) {
      Request.post({
        url: `${serverUrl}/company/${company._id.toString()}/token`,
        headers: { authorization: jwt },
        json: true
      }, (err, res, { token }) => cb(err, { jwt, company, token }))
    },
    function revokeToken ({ jwt, company, token }, cb) {
      Request.patch({
        url: `${serverUrl}/company/${company._id.toString()}/token/${token}`,
        headers: { authorization: jwt },
        json: true
      }, (err, res, { token }) => cb(err, { res, token }))
    },
    function getRevokedToken ({ res, token }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      db.tokens.count({ _id: ObjectId(token), revoked: true }, cb)
    },
    function verifyTokenIsRevoked (count, cb) {
      t.ok(count, 'Revoked token is in database')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Stop server', (t) => {
  t.plan(1)
  Server.stop((err, ctx) => {
    t.ifError(err, 'Server stopped successfully')
    t.end()
  })
})
