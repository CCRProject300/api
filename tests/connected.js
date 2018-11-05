const test = require('tape')
const Request = require('request')
const Async = require('async')
const faker = require('faker')
const ObjectId = require('mongojs').ObjectId
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const authUser = require('./helpers/auth-user')

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

test('Should be not be able to connect to a non-existent strategy', (t) => {
  t.plan(2)

  const randomToken = faker.internet.password()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => {
        cb(err, { user, token })
      })
    },
    function connectMethod ({ user, token }, cb) {
      Request.post({
        url: `${serverUrl}/connect/foobar`,
        json: {
          accessToken: randomToken,
          profile: {}
        },
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { user, token, res, body }))
    },
    function verifyResponse ({ user, token, res, body }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb(null)
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to connect and disconnect a user to/from a strategy', (t) => {
  t.plan(7)

  const randomToken = faker.internet.password()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => {
        cb(err, { user, token })
      })
    },
    function connectMethod ({ user, token }, cb) {
      Request.post({
        url: `${serverUrl}/connect/runkeeper`,
        json: {
          accessToken: randomToken,
          profile: {}
        },
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { user, token, res, body }))
    },
    function verifyResponse ({ user, token, res, body }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.ok(body.methods.indexOf('runkeeper') > -1, 'Returned user doc has required method')
      db.users.findOne({ _id: ObjectId(user._id) }, (err, userDoc) => {
        if (err) return cb(err)
        t.ok(userDoc.methods.find((m) => m.strategy === 'runkeeper'), 'Stored user doc has required method')
        cb(null, { user, token })
      })
    },
    function disconnectMethod ({ user, token }, cb) {
      Request.post({
        url: `${serverUrl}/disconnect/runkeeper`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { user, res, body }))
    },
    function verifyResponse ({ user, res, body }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.notOk(body.methods.indexOf('runkeeper') > -1, 'Returned user doc no longer has previously added method')
      db.users.findOne({ _id: ObjectId(user._id) }, (err, userDoc) => {
        if (err) return cb(err)
        t.notOk(userDoc.methods.find((m) => m.strategy === 'runkeeper'), 'Stored user doc no longer has previously added method')
        cb(null)
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to disconnect a user from a strategy they aren\'t connected to', (t) => {
  t.plan(5)

  const randomToken = faker.internet.password()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function login (user, cb) {
      authUser(serverUrl, user.authData, (err, token) => {
        cb(err, { user, token })
      })
    },
    function connectMethod ({ user, token }, cb) {
      Request.post({
        url: `${serverUrl}/connect/runkeeper`,
        json: {
          accessToken: randomToken,
          profile: {}
        },
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { user, token, res, body }))
    },
    function verifyResponse ({ user, token, res, body }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.ok(body.methods.indexOf('runkeeper') > -1, 'Returned user doc has required method')
      db.users.findOne({ _id: ObjectId(user._id) }, (err, userDoc) => {
        if (err) return cb(err)
        t.ok(userDoc.methods.find((m) => m.strategy === 'runkeeper'), 'Stored user doc has required method')
        cb(null, { user, token })
      })
    },
    function disconnectMethod ({ user, token }, cb) {
      Request.post({
        url: `${serverUrl}/disconnect/strava`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { user, res, body }))
    },
    function verifyResponse ({ user, res, body }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb(null)
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
