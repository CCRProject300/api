const test = require('tape')
const config = require('config')
const async = require('async')
const db = require('mongojs')(config.mongo)
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const tasks = require('../lib/cron-tasks')
const pugTpl = require('../emails/user-notify-missing-stats').body
const artifacts = require('./artifacts')

const mailer = {
  send: (tpl, email, data, cb) => {
    console.log('sending email to ', email)
    cb()
  }
}

test('Should remind users to complete their individual stats', (t) => {
  t.plan(2)

  const users = [
    {
      height: null,
      weight: 86
    },
    {
      height: null,
      emailPreferences: {
        connected: false
      }
    }
  ]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(users, (user, done) => addUser(db, user, done), cb),
    (users, cb) => tasks.missingStats.emails({ db, mailer }, cb)
  ], (err, report) => {
    t.ifError(err, 'no error')
    t.equal(report.success, 1, 'email reminder sent')
    t.end()
  })
})

test('Should render the email correctly', (t) => {
  t.plan(2)
  const userData = {
    firstName: 'Test',
    height: null,
    weight: 80,
    dob: null,
    gender: null
  }
  addUser(db, userData, (err, user) => {
    t.ifError(err, 'no error')
    const tplData = {
      name: user.firstName,
      missingStats: ['height', 'weight', 'dob', 'gender'].filter((field) => !user[field]),
      frontendUrl: 'http://test.kudoshealth.com'
    }
    t.equal(pugTpl(tplData), artifacts['user-notify-missing-stats'], 'email template renders correctly')
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
