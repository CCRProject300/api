const test = require('tape')
const Async = require('async')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const addCompany = require('./helpers/add-company')

test('Should award a single coin when a user visits the site', withServer((t, { server, db }) => {
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10 })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function visitSite ({ users, company }, cb) {
      const user = users[1]

      server.inject({
        method: 'GET',
        url: '/user',
        headers: { authorization: getToken(user) }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        cb(null, user)
      })
    },
    function secondVisit (user, cb) {
      server.inject({
        method: 'GET',
        url: '/user',
        headers: { authorization: getToken(user) }
      }, (res) => db.users.findOne({_id: user._id}, cb))
    }
  ], (err, user) => {
    t.ifError(err, 'No error')
    t.equal(user.kudosCoins, 11)
    db.close()
    t.end()
  })
}))
