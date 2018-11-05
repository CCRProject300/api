const test = require('tape')
const config = require('config')
const Async = require('async')
const moment = require('moment')
const sinon = require('sinon')
const db = require('mongojs')(config.mongo)
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const fakeTransactionLog = require('./helpers/fake-transaction-log')
const fakeShopItem = require('./helpers/fake-shop-item')
const tasks = require('../lib/cron-tasks')

const mailer = {
  send: (tpl, email, data, cb) => cb()
}

test('Should send correct purchase notifications', (t) => {
  t.plan(9)

  const spy = sinon.spy(mailer, 'send')

  const createdAt = new Date()
  const oldTransactionCreatedAt = moment().subtract(7, 'days').toDate()
  const purchaseUserIndices = [2, 4, 4, 5]

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addUsers (cb) { Async.times(6, (_, done) => addUser(db, done), cb) },
    function addCompanies (users, cb) {
      Async.parallel([
        // Company with two corporate mods and one normal member
        (done) => addCompany(db, { users: users.slice(0, 3), modCount: 2 }, done),
        // Company with one corporate mod and two normal members
        (done) => addCompany(db, { users: users.slice(3) }, done)
      ], (err, companies) => {
        if (err) return cb(err)
        cb(null, { users, companies })
      })
    },
    function addShopItem ({ users, companies }, cb) {
      db.shopItems.insert(fakeShopItem(), (err, item) => cb(err, { users, companies, item }))
    },
    function addTransactionLogs ({ users, companies, item }, cb) {
      Async.each(purchaseUserIndices, (index, done) => {
        const user = users[index]
        const company = companies[Math.floor(index / 3)]
        db.transactionLogs.insert(fakeTransactionLog({
          user: {
            _id: user._id,
            avatar: user.avatar,
            firstName: user.firstName,
            lastName: user.lastName
          },
          company: { _id: company._id },
          createdAt,
          data: { item },
          type: 'purchase'
        }), done)
      }, (err) => {
        if (err) return cb(err)

        // Insert old transaction log
        db.transactionLogs.insert(fakeTransactionLog({
          user: {
            _id: users[0]._id,
            avatar: users[0].avatar,
            firstName: users[0].firstName,
            lastName: users[0].lastName
          },
          company: { _id: companies[0]._id },
          createdAt: oldTransactionCreatedAt,
          data: { item },
          type: 'purchase'
        }), cb)
      })
    },
    function runCronTask (_, cb) {
      tasks.purchasesNotification({ db, mailer }, cb)
    }
  ], (err, results) => {
    t.ifError(err, 'no error')
    results = results.sort(({ _id: idA }, { _id: idB }) => idA > idB ? 1 : -1)
    t.equal(results.length, 2, 'both companies should receive notifications')
    t.equal(results[0].count, 1, 'the first company should record one purchase')
    t.equal(results[1].count, 3, 'the second company should record two purchases')
    t.equal(results[0].moderators.length, 2, 'the first company should have two moderators notified')
    t.equal(results[1].moderators.length, 1, 'the second company should have one moderator notified')

    t.equal(spy.callCount, 2, 'Two mails have been sent')

    Async.each(results, ({ moderators }, done) => {
      db.notifications.count({ type: 'purchase', 'user._id': { $in: moderators.map(({ _id }) => _id) } }, (err, count) => {
        t.ifError(err, 'no error')
        // t.equal(count, moderators.length, 'Correct number of notifications should have been created')
        done()
      })
    }, () => {
      mailer.send.restore()
      t.end()
    })
  })
})

test('Close the database', (t) => {
  t.plan(1)
  db.close((err) => {
    t.ifError(err, 'db closed')
    t.end()
  })
})
