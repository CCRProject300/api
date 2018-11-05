const test = require('tape')
const config = require('config')
const Async = require('async')
const createDb = require('../lib/db')
const createActions = require('../lib/actions')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')

test('Should not be able to join as company moderator if already activated', (t) => {
  t.plan(3)

  const db = createDb(config)
  const actions = createActions(db)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    (user, cb) => {
      addCompany(db, { users: [user] }, (err, company) => {
        cb(err, company, user)
      })
    },
    (company, user, cb) => {
      actions.joinCompanyAsCorpMod({
        userId: user._id,
        companyId: company._id,
        confirm: true
      }, (err) => {
        t.ok(err, 'Error expected')
        t.equal(err.message, 'User has already been activated in company')
        cb()
      })
    }
  ], (err) => {
    db.close(true)
    t.ifError(err, 'No error during test')
    t.end()
  })
})
