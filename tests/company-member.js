const test = require('tape')
const Request = require('request')
const Async = require('async')
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
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

test('Should be able to remove a company member', (t) => {
  t.plan(3)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    // Add 2 users, one to be moderator one to be member
    (cb) => Async.times(2, (i, cb) => addUser(db, cb), cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { company, users })
    }),
    function loginModerator ({ company, users }, cb) {
      authUser(serverUrl, users[0].authData, (err, token) => {
        cb(err, { token, company, users })
      })
    },
    function deleteMember ({ token, company, users }, cb) {
      Request.del({
        url: `${serverUrl}/company/${company._id}/member/${users[1]._id}`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, { res, company, users }))
    },
    function verifyResponse ({ res, company, users }, cb) {
      t.equal(res.statusCode, 204, 'Status code is 204')
      cb(null, { company, users })
    },
    function getUpdatedCompany ({ company, users }, cb) {
      db.companies.findOne({ _id: company._id }, (err, company) => {
        cb(err, { company, users })
      })
    },
    function assertCompanyMemberRemoved ({ company, users }, cb) {
      const exists = company.members.some((m) => m.user.equals(users[1]._id))
      t.equal(exists, false, 'Member was removed')
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
