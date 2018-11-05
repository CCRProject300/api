const test = require('tape')
const Async = require('async')
const Faker = require('faker')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const fakeCompany = require('./helpers/fake-company')
const { fakeMember, fakeModerator } = fakeCompany
const fakeShopItem = require('./helpers/fake-shop-item')

test('should be able to fetch all in-stock shop items', withServer((t, { server, db }) => {
  t.plan(3)

  const TOTAL_IN_STOCK_ITEMS = 3

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(TOTAL_IN_STOCK_ITEMS, (_, cb) => {
        db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    // Also add an item not in stock
    function addOutOfStockItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id }, stockLevel: 0 })
      db.shopItems.insert(itemData, (err) => cb(err, { user, company }))
    },
    // Also add a deleted item
    function addOutOfStockItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id }, deleted: true })
      db.shopItems.insert(itemData, (err) => cb(err, { user, company }))
    },
    // Also add an item not belonging to this company
    function addOtherCompanyItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem(), (err) => cb(err, { user, company }))
    },
    function getShopItems ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/items`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result.length, TOTAL_IN_STOCK_ITEMS, 'All in-stock items retrieved')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to fetch all shop items if company moderator', withServer((t, { server, db }) => {
  t.plan(3)

  const TOTAL_IN_STOCK_ITEMS = 3

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(TOTAL_IN_STOCK_ITEMS, (_, cb) => {
        db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    // Also add an item not in stock
    function addOutOfStockItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id }, stockLevel: 0 })
      db.shopItems.insert(itemData, (err) => cb(err, { user, company }))
    },
    // Also add a deleted item
    function addOutOfStockItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id }, deleted: true })
      db.shopItems.insert(itemData, (err) => cb(err, { user, company }))
    },
    // Also add an item not belonging to this company
    function addOtherCompanyItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem(), (err) => cb(err, { user, company }))
    },
    function getShopItems ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/items`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result.length, TOTAL_IN_STOCK_ITEMS + 1, 'All items retrieved')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch shop items if not logged in', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addCompany (cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { company }))
    },
    function addItems ({ company }, cb) {
      Async.times(Faker.random.number({ min: 1, max: 100 }), (_, cb) => {
        db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { company }))
    },
    function getShopItems ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/items`
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 401, 'Status code is 401')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch shop items if not company member', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(Faker.random.number({ min: 1, max: 100 }), (_, cb) => {
        db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getShopItems ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/items`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 403, 'Status code is 403')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch shop items if not has role rewards', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItems ({ user, company }, cb) {
      Async.times(Faker.random.number({ min: 1, max: 100 }), (_, cb) => {
        db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getShopItems ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/items`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 403, 'Status code is 403')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
