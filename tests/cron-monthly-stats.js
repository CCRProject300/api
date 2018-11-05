const test = require('tape')
const config = require('config')
const async = require('async')
const db = require('mongojs')(config.mongo)
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const tasks = require('../lib/cron-tasks')
const fakeCompanyLeaderboard = require('./helpers/fake-company-leaderboard')
const fakeCompanyStandings = require('./helpers/fake-company-standings')
const emailTpl = require('../emails/moderator-monthly-stats').body

const mailer = {
  send: (tpl, email, data, cb) => cb()
}

const users = [
  {firstName: 'bernard', companyName: 'TABLEFLIP', location: 'JAILmake', department: 'Programming'},
  {firstName: 'richard', companyName: 'TABLEFLIP', location: 'JAILmake', department: 'Programming'},
  {firstName: 'oli', companyName: 'TABLEFLIP', location: 'JAILmake', department: 'Programming'}
]

test('Should send monthly summary emails to moderators', (t) => {
  t.plan(2)

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(users, (user, done) => addUser(db, user, done), cb),
    (users, cb) => addCompany(db, {users, name: 'TABLEFLIP'}, cb),
    (company, cb) => tasks.monthlyStats({ db, mailer }, cb)
  ], (err, result) => {
    t.ifError(err, 'no error')
    t.equal(result.fail, 1, 'cron job emails only moderator, and fails because there are no standings')
    t.end()
  })
})

test('Should render results in an email', (t) => {
  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(users, (user, done) => addUser(db, user, done), cb),
    (users, cb) => addCompany(db, {users, name: 'TABLEFLIP'}, cb),
    (company, cb) => {
      const leaderboard = fakeCompanyLeaderboard({companyId: company._id})
      db.dailystats.insert(leaderboard, cb)
    }
  ], (err, leaderboard) => {
    t.ifError(err, 'no error')
    const stats = {
      leaderboard: leaderboard,
      standings: fakeCompanyStandings()
    }
    const email = emailTpl({ moderator: {companyName: 'TABLEFLIP'}, stats: stats, frontendUrl: 'https://test.kudoshealth.com' })
    t.ok(email)
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
