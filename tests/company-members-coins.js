const test = require('tape')
const Async = require('async')
const Faker = require('faker')
const sinon = require('sinon')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const addCompany = require('./helpers/add-company')

test('Should be able to distribute coins', withServer((t, { server, db }) => {
  const reason = Faker.lorem.words(5)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - users[1-3] are company members
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10 }),
      addUser.bind(addUser, db, { kudosCoins: 20 }),
      addUser.bind(addUser, db, { kudosCoins: 30 })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function distributeCoins ({ users, company }, cb) {
      const moderator = users[0]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/members/coins`,
        headers: { authorization: getToken(moderator) },
        payload: {
          reason,
          userIds: users.slice(1, 3).map(({ _id }) => _id.toString()),
          kudosCoins: 5
        }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        Async.parallel({
          users: (done) => db.users.find({ _id: { $in: users.slice(1).map(({ _id }) => _id) } }).sort({ kudosCoins: -1 }, done),
          transactions: (done) => db.transactionLogs.find({type: {$ne: 'daily-coin'}}).sort({ _id: -1 }, done)
        }, (err, res) => {
          if (err) return cb(err)
          cb(null, Object.assign(res, { moderator }))
        })
      })
    },
    function checkResults ({ users, transactions, moderator }, cb) {
      t.deepEqual(users.map(({ kudosCoins }) => kudosCoins), [30, 25, 15], 'KudosCoins have been distributed correctly')
      transactions.forEach((transaction) => {
        t.equal(transaction.reason, reason, 'Reason is correct')
        t.ok(transaction.createdBy._id.equals(moderator._id), 'Moderator id is recorded')
        t.equal(transaction.kudosCoins, 5, 'Correct number of KudosCoins are recorded')
      })
      t.deepEqual(transactions.map(({ user: { _id } }) => _id.toString()), users.slice(1, 3).map(({ _id }) => _id.toString()), 'Correct users are recorded')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to distribute coins to user outside the company', withServer((t, { server, db }) => {
  const reason = Faker.lorem.words(5)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  // - user[2] is not a member of the company
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10 }),
      addUser.bind(addUser, db, { kudosCoins: 20 })
    ], cb),
    (users, cb) => addCompany(db, { users: users.slice(0, 2) }, (err, company) => {
      cb(err, { users, company })
    }),
    function distributeCoins ({ users, company }, cb) {
      const moderator = users[0]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/members/coins`,
        headers: { authorization: getToken(moderator) },
        payload: {
          reason,
          userIds: users.map(({ _id }) => _id.toString()),
          kudosCoins: 5
        }
      }, (res) => {
        t.equal(res.statusCode, 403, 'Status code is 403')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to distribute a negative number of coins', withServer((t, { server, db }) => {
  const reason = Faker.lorem.words(5)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10 })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function distributeCoins ({ users, company }, cb) {
      const moderator = users[0]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/members/coins`,
        headers: { authorization: getToken(moderator) },
        payload: {
          reason,
          userIds: users.map(({ _id }) => _id.toString()),
          kudosCoins: -1
        }
      }, (res) => {
        t.equal(res.statusCode, 400, 'Status code is 400')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to distribute coins without a reason', withServer((t, { server, db }) => {
  const reason = ''

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10 })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function distributeCoins ({ users, company }, cb) {
      const moderator = users[0]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/members/coins`,
        headers: { authorization: getToken(moderator) },
        payload: {
          reason,
          userIds: users.map(({ _id }) => _id.toString()),
          kudosCoins: 1
        }
      }, (res) => {
        t.equal(res.statusCode, 400, 'Status code is 400')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should notify uses when distributing coins', withServer((t, { server, db, mailer }) => {
  const reason = Faker.lorem.words(5)
  const spy = sinon.spy(mailer, 'send')
  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - users[1-3] are company members
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10 }),
      addUser.bind(addUser, db, { kudosCoins: 20 }),
      addUser.bind(addUser, db, { kudosCoins: 30 })
    ], cb),
    (users, cb) => addCompany(db, { users, name: 'TABLEFLIP' }, (err, company) => {
      cb(err, { users, company })
    }),
    function distributeCoins ({ users, company }, cb) {
      const moderator = users[0]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/members/coins`,
        headers: { authorization: getToken(moderator) },
        payload: {
          reason,
          userIds: users.slice(1).map(({ _id }) => _id.toString()),
          kudosCoins: 5
        }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        Async.parallel({
          users: (done) => db.users.find({ _id: { $in: users.slice(1).map(({ _id }) => _id) } }).sort({ kudosCoins: -1 }, done),
          transactions: (done) => db.transactionLogs.find({}).sort({ _id: -1 }, done)
        }, (err, res) => {
          if (err) return cb(err)
          cb(null, Object.assign(res, { moderator }))
        })
      })
    },
    function checkResults ({ users, transactions, moderator }, cb) {
      t.equal(spy.callCount, 3, 'mailer called three times')
      const emails = users.map(({ emails }) => emails[0].address)
      const sentEmails = spy.getCalls().map((call) => call.args[1])
      t.ok(emails.every(email => sentEmails.indexOf(email) > -1))
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
