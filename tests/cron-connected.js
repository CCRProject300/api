const test = require('tape')
const config = require('config')
const async = require('async')
const db = require('mongojs')(config.mongo)
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const tasks = require('../lib/cron-tasks')

const mailer = {
  send: (tpl, email, data, cb) => {
    console.log('sending email to ', email)
    cb()
  }
}

test('Should be able to determine when no device is connected', (t) => {
  t.plan(5)

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    (user, cb) => {
      t.ok(user, 'got a user')
      t.notOk(user.methods, 'with no methods property (no devices)')
      tasks.connected({ db, mailer }, cb)
    },
    (result, cb) => {
      t.ok(result, 'tasks.connected returns a result')
      t.equal(result.users, 1, 'one email was sent')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no error')
    t.end()
  })
})

test('Should not send emails if emailPreference is set to false', (t) => {
  t.plan(3)

  const emailPreferences = {
    emailPreferences: {
      connected: false
    }
  }

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, emailPreferences, cb),
    (user, cb) => {
      t.notOk(user.emailPreferences.connected, 'email preferences set to false')
      tasks.connected({ db, mailer }, cb)
    },
    (result, cb) => {
      t.equal(result.users, 0, 'no email was sent')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no error')
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
