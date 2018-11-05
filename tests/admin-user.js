const test = require('tape')
const Async = require('async')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')

test('should be able to get user', withServer((t, { server, db }) => {
  t.plan(8)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addUsers (cb) {
      Async.parallel({
        admin: (done) => addUser(db, { roles: ['admin'] }, done),
        user: (done) => addUser(db, { roles: ['user'], companyName: 'TEST' }, done)
      }, cb)
    },
    function getUser ({ admin, user }, cb) {
      server.inject({
        method: 'GET',
        url: `/admin/user/${user._id}`,
        headers: { authorization: getToken(admin.authData) }
      }, (res) => cb(null, { res, user }))
    },
    function verifyResponse ({ res, user }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result._id.toString(), user._id.toString(), 'ID is correct')
      t.equal(res.result.firstName, user.firstName, 'First name is correct')
      t.equal(res.result.lastName, user.lastName, 'Last name is correct')
      t.equal(res.result.companyName, user.companyName, 'Company name is correct')
      t.deepEqual(res.result.emails, user.emails, 'Emails are correct')
      t.deepEqual(res.result.roles, user.roles, 'Roles are correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should respond 404 for missing user', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['admin'] }, cb),
    function getUser (admin, cb) {
      server.inject({
        method: 'GET',
        url: '/admin/user/599d9d8a913a5d68e2b52346',
        headers: { authorization: getToken(admin.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to update user roles', withServer((t, { server, db }) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addUsers (cb) {
      Async.parallel({
        admin: (done) => addUser(db, { roles: ['admin'] }, done),
        user: (done) => addUser(db, { roles: ['user'] }, done)
      }, cb)
    },
    function updateUser ({ admin, user }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/admin/user/${user._id}`,
        headers: { authorization: getToken(admin.authData) },
        payload: { roles: ['corporate_mod', 'roleA'] }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.deepEqual(res.result.roles, ['corporate_mod', 'roleA'], 'Roles are correct')
      cb(null, { res })
    },
    function findUpdatedUser ({ res }, cb) {
      db.users.findOne({ _id: res.result._id }, cb)
    },
    function verifyDbUpdate (user, cb) {
      t.deepEqual(user.roles, ['corporate_mod', 'roleA'], 'Roles are correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to update user with unrecognised role', withServer((t, { server, db }) => {
  t.plan(3)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addUsers (cb) {
      Async.parallel({
        admin: (done) => addUser(db, { roles: ['admin'] }, done),
        user: (done) => addUser(db, { roles: ['user'] }, done)
      }, cb)
    },
    function updateUser ({ admin, user }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/admin/user/${user._id}`,
        headers: { authorization: getToken(admin.authData) },
        payload: { roles: ['corporate_mod', 'roleA', 'BAD_ROLE'] }
      }, (res) => cb(null, { res, user }))
    },
    function verifyResponse ({ res, user }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb(null, user)
    },
    function findUpdatedUser (user, cb) {
      db.users.findOne({ _id: user._id }, cb)
    },
    function verifyDbUpdate (user, cb) {
      t.deepEqual(user.roles, ['user'], 'Roles remain the same')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
