const test = require('tape')
const Async = require('async')
const sinon = require('sinon')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const addCompany = require('./helpers/add-company')
const fakeShopItem = require('./helpers/fake-shop-item')
const moment = require('moment')

test('Should be able to purchase an item', withServer((t, { server, db }) => {
  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10, roles: ['rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addItem ({ users, company }, cb) {
      const item = fakeShopItem({
        company: { _id: company._id },
        stockLevel: 1,
        price: 2
      })

      db.shopItems.insert(item, (err, item) => {
        cb(err, { users, company, item })
      })
    },
    function purchaseItem ({ users, company, item }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item/${item._id}/buy`,
        headers: { authorization: getToken(member) }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        Async.parallel({
          item: (done) => db.shopItems.findOne({ _id: item._id }, done),
          user: (done) => db.users.findOne({ _id: member._id }, done),
          transaction: (done) => db.transactionLogs.findOne({ 'user._id': member._id, 'data.item._id': item._id, type: {$ne: 'daily-coin'} }, done)
        }, cb)
      })
    },
    function checkResults ({ item, user, transaction }, cb) {
      t.equal(item.stockLevel, 0, 'Item stock level is reduced')
      t.equal(user.kudosCoins, 9, 'User KudosCoins level is reduced') // remember you get a coin for visiting the site
      t.ok(transaction, 'Transaction log has been updated')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to purchase an item which is out of stock', withServer((t, { server, db }) => {
  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10, roles: ['rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addItem ({ users, company }, cb) {
      const item = fakeShopItem({
        company: { _id: company._id },
        stockLevel: 0,
        price: 2
      })

      db.shopItems.insert(item, (err, item) => {
        cb(err, { users, company, item })
      })
    },
    function purchaseItem ({ users, company, item }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item/${item._id}/buy`,
        headers: { authorization: getToken(member) }
      }, (res) => {
        t.equal(res.statusCode, 409, 'Status code is 409')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to purchase an item with insufficient kudosCoins', withServer((t, { server, db }) => {
  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 0, roles: ['rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addItem ({ users, company }, cb) {
      const item = fakeShopItem({
        company: { _id: company._id },
        stockLevel: 1,
        price: 2
      })

      db.shopItems.insert(item, (err, item) => {
        cb(err, { users, company, item })
      })
    },
    function purchaseItem ({ users, company, item }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item/${item._id}/buy`,
        headers: { authorization: getToken(member) }
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

test('Should not be able to purchase an item from a different company', withServer((t, { server, db }) => {
  // create 2 users
  // - user[0] is the company mod of both companies
  // - user[1] is a company member of company A ONLY
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 1, roles: ['rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addSecondCompany ({ users, company: companyA }, cb) {
      addCompany(db, { users: users.slice(0, 1) }, (err, companyB) => {
        cb(err, { users, companyA, companyB })
      })
    },
    function addItem ({ users, companyA, companyB }, cb) {
      const item = fakeShopItem({
        company: { _id: companyB._id },
        stockLevel: 1,
        price: 2
      })

      db.shopItems.insert(item, (err, item) => {
        cb(err, { users, company: companyA, item })
      })
    },
    function purchaseItem ({ users, company, item }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item/${item._id}/buy`,
        headers: { authorization: getToken(member) }
      }, (res) => {
        t.equal(res.statusCode, 404, 'Status code is 404')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should send an email receipt', withServer((t, { server, db, mailer }) => {
  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  const spy = sinon.spy(mailer, 'send')
  let member

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10, roles: ['rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users, name: 'test company' }, (err, company) => {
      cb(err, { users, company })
    }),
    function addItem ({ users, company }, cb) {
      const item = fakeShopItem({
        company: { _id: company._id },
        stockLevel: 1,
        price: 2
      })

      db.shopItems.insert(item, (err, item) => {
        cb(err, { users, company, item })
      })
    },
    function purchaseItem ({ users, company, item }, cb) {
      member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item/${item._id}/buy`,
        headers: { authorization: getToken(member) }
      }, (res) => cb())
    },
    (cb) => {
      db.transactionLogs.findOne({'user._id': member._id}, cb)
    }
  ], (err, transaction) => {
    t.ifError(err, 'No error')
    t.equal(spy.callCount, 1, 'email receipt has been sent')
    const email = member.emails[0].address
    t.ok(moment.isDate(transaction.createdAt))
    t.ok(spy.calledWith('user-shop-purchase-receipt', email))
    db.close()
    t.end()
  })
}))
