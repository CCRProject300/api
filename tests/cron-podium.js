const test = require('tape')
const config = require('config')
const async = require('async')
const db = require('mongojs')(config.mongo)
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const fakeDailyStat = require('./helpers/fake-daily-stat')
const tasks = require('../lib/cron-tasks')
const faker = require('faker')

const mailer = {
  send: (tpl, email, data, cb) => cb()
}

test('Should send weekly Podium places summary email', (t) => {
  t.plan(2)

  const users = [
    {firstName: 'bernard'},
    {firstName: 'richard'},
    {firstName: 'oli'}
  ]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(users, (user, done) => addUser(db, user, done), cb),
    (users, cb) => addCompany(db, {users}, cb),
    (company, cb) => {
      const dailyStat = fakeDailyStat({
        companyName: company.name,
        companyId: company._id
      })
      db.dailyStats.insert(dailyStat, cb)
    },
    (stats, cb) => tasks.podium({ db, mailer }, cb)
  ], (err, result) => {
    t.ifError(err, 'no error')
    t.equal(result.success, 3, 'cron job emails sent successfully')
    t.end()
  })
})

test('Should only send emails to users with emailPreference podium set to true', (t) => {
  t.plan(2)

  const users = [
    {
      firstName: 'bernard',
      emailPreferences: {
        podium: false
      }
    },
    {firstName: 'richard'},
    {firstName: 'oli'}
  ]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(users, (user, done) => addUser(db, user, done), cb),
    (users, cb) => {
      const deactivateUser = users.filter((user) => user.firstName === 'oli')[0]._id
      addCompany(db, {users, deactivateUser}, cb)
    },
    (company, cb) => db.dailyStats.insert(fakeDailyStat({companyId: company._id}), cb),
    (stats, cb) => tasks.podium({ db, mailer }, cb),
    (result, cb) => {
      t.equal(result.success, 1, 'cron job ignores those with notifications off and active false')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no error')
    t.end()
  })
})

test('Should not error if emailPreferences is null/undefined', (t) => {
  t.plan(2)

  const user = { emailPreferences: null }

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, user, cb),
    (user, cb) => addCompany(db, { users: [user] }, cb),
    (company, cb) => {
      const dailyStat = fakeDailyStat({
        companyName: company.name,
        companyId: company._id
      })
      db.dailyStats.insert(dailyStat, cb)
    },
    (stats, cb) => tasks.podium({ db, mailer }, cb)
  ], (err, result) => {
    t.ifError(err, 'no error')
    t.equal(result.success, 0, 'cron job emails sent successfully')
    t.end()
  })
})

test('Should ignore deleted users', (t) => {
  t.plan(2)

  const users = [
    {firstName: 'oli'},
    {firstName: 'alan', deleted: true}
  ]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(users, (user, done) => addUser(db, user, done), cb),
    (users, cb) => addCompany(db, {users}, cb),
    (company, cb) => {
      const dailyStat = fakeDailyStat({
        companyName: company.name,
        companyId: company._id
      })
      db.dailyStats.insert(dailyStat, cb)
    },
    (stats, cb) => tasks.podium({ db, mailer }, cb)
  ], (err, result) => {
    t.ifError(err, 'no error')
    t.equal(result.success, 1, 'deleted user ignored')
    t.end()
  })
})

test('Should handle no stats being avaliable', (t) => {
  t.plan(1)

  const users = [{}, {}, {}]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => {
      async.map(users, (user, done) => {
        addUser(db, user, done)
      }, (err, insertedUsers) => {
        cb(err, insertedUsers)
      })
    },
    (users, cb) => addCompany(db, {users}, cb),
    (company, cb) => db.dailyStats.insert(fakeDailyStat({companyId: company._id, date: faker.date.past()}), cb),
    (stats, cb) => tasks.podium({ db, mailer }, cb)
  ], (err) => {
    t.ok(err, 'retuns an error')
    t.end()
  })
})

test('Close the database', (t) => {
  t.plan(1)
  db.close((err) => {
    t.ifError(err, 'db closed')
    t.end()
  })
})
