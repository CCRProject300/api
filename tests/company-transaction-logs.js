const test = require('tape')
const Async = require('async')
const moment = require('moment')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const fakeCompany = require('./helpers/fake-company')
const { fakeMember, fakeModerator } = fakeCompany
const fakeTransactionLog = require('./helpers/fake-transaction-log')

test('should be able to fetch all relevant logs if a company moderator', withServer((t, { server, db }) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(10, (ind, cb) => {
        db.transactionLogs.insert(fakeTransactionLog({
          company: { _id: company._id },
          type: 'purchase'
        }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getLogs ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/transaction-logs`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, res))
    },
    function verifyResponse ({ statusCode, result = {} }, cb) {
      t.equal(statusCode, 200, 'Status code is 200')
      t.equal(result.total, 10, 'Log count is correct')
      t.equal(result.logs.length, 10, 'All logs retrieved')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch logs if only a company member', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(10, (ind, cb) => {
        db.transactionLogs.insert(fakeTransactionLog({
          company: { _id: company._id },
          type: 'purchase'
        }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getLogs ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/transaction-logs`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, res))
    },
    function verifyResponse ({ statusCode }, cb) {
      t.equal(statusCode, 403, 'Status code is 403')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should only receive purchase and distribution logs', withServer((t, { server, db }) => {
  t.plan(6)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.each(['distribution', 'purchase', 'activity', 'activity-adjustment'], (type, cb) => {
        db.transactionLogs.insert(fakeTransactionLog({
          type,
          company: { _id: company._id }
        }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getLogs ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/transaction-logs`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, res))
    },
    function verifyResponse ({ statusCode, result = {} }, cb) {
      t.equal(statusCode, 200, 'Status code is 200')
      t.equal(result.total, 2, 'Log count is correct')
      t.equal(result.logs.length, 2, 'All relevant logs retrieved')
      result.logs.forEach(({ type }) => {
        t.ok(['distribution', 'purchase'].some((t) => t === type), 'Logs are in the correct category')
      })
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
    { qs: 'limit=2', kudosCoinVals: [1, 2] },
    { qs: 'limit=3', kudosCoinVals: [1, 2, 3] },
    { qs: 'skip=2&limit=2', kudosCoinVals: [3, 4] },
    { qs: 'skip=8&limit=5', kudosCoinVals: [9, 10] },
    { qs: 'skip=1', kudosCoinVals: [2, 3, 4, 5, 6, 7, 8, 9, 10] }
  ]

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(10, (ind, cb) => {
        db.transactionLogs.insert(fakeTransactionLog({
          company: { _id: company._id },
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
          url: `/company/${company._id}/transaction-logs?${qs}`,
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
