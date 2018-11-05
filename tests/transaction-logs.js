const test = require('tape')
const Async = require('async')
const moment = require('moment')
const Faker = require('faker')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const fakeCompany = require('./helpers/fake-company')
const { fakeMember } = fakeCompany
const fakeTransactionLog = require('./helpers/fake-transaction-log')
const { toUserRef } = require('../lib/user')

test('should be able to get transaction logs', withServer((t, { server, db }) => {
  t.plan(4)

  const TOTAL_LOGS = Faker.random.number({ min: 10, max: 25 })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addLogs ({ user, company }, cb) {
      const userRef = toUserRef(user)
      Async.times(TOTAL_LOGS, (ind, cb) => {
        db.transactionLogs.insert(fakeTransactionLog({
          company: { _id: company._id },
          user: userRef
        }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getLogs ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: '/transaction-logs',
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, res))
    },
    function verifyResponse ({ statusCode, result }, cb) {
      t.equal(statusCode, 200, 'Status code is 200')
      t.equal(result.total, TOTAL_LOGS, 'Log count is correct')
      t.equal(result.logs.length, TOTAL_LOGS, 'All logs retrieved')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to skip and limit returned logs', withServer((t, { server, db }) => {
  t.plan(21)

  const logMap = [
    { qs: 'limit=2&types=purchase', kudosCoinVals: [1, 2] },
    { qs: 'limit=3&types=purchase', kudosCoinVals: [1, 2, 3] },
    { qs: 'skip=2&limit=2&types=purchase', kudosCoinVals: [3, 4] },
    { qs: 'skip=8&limit=5&types=purchase', kudosCoinVals: [9, 10] },
    { qs: 'skip=1&types=purchase', kudosCoinVals: [2, 3, 4, 5, 6, 7, 8, 9, 10] }
  ]

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addLogs ({ user, company }, cb) {
      const userRef = toUserRef(user)
      Async.times(10, (ind, cb) => {
        db.transactionLogs.insert(fakeTransactionLog({
          company: { _id: company._id },
          user: userRef,
          kudosCoins: ind + 1,
          createdAt: moment.utc().subtract(ind + 1, 'hours').toDate(),
          type: 'purchase'
        }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getLogs ({ user, company }, cb) {
      Async.each(logMap, ({ qs, kudosCoinVals }, done) => {
        server.inject({
          method: 'GET',
          url: `/transaction-logs?${qs}`,
          headers: { authorization: getToken(user.authData) }
        }, ({ statusCode, result = {} }, cb) => {
          t.equal(statusCode, 200, 'Status code is 200')
          t.equal(result.total, 10, 'Log count is correct')
          t.equal(result.logs.length, kudosCoinVals.length, 'Correct number of logs retrieved')
          t.deepEqual(result.logs.map(({ kudosCoins }) => kudosCoins), kudosCoinVals, 'Correct logs are returned')
          done()
        })
      }, cb)
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
