const test = require('tape')
const Async = require('async')
const ObjectId = require('mongojs').ObjectId
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const fakeCompany = require('./helpers/fake-company')
const { fakeMember, fakeModerator } = fakeCompany
const fakeShopItem = require('./helpers/fake-shop-item')
const fakeShopItemPayload = require('./helpers/fake-shop-item-payload')

test('should be able to fetch an in-stock shop item', withServer((t, { server, db }) => {
  t.plan(3)

  let fakeItem

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItem ({ user, company }, cb) {
      fakeItem = fakeShopItem({ company: { _id: company._id } })
      db.shopItems.insert(fakeItem, (err, item) => cb(err, { user, company, item }))
    },
    function getShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result.name, fakeItem.name, 'Correct item is returned')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to fetch an out of stock shop item if company moderator', withServer((t, { server, db }) => {
  t.plan(3)

  let fakeItem

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItem ({ user, company }, cb) {
      fakeItem = fakeShopItem({ company: { _id: company._id }, stockLevel: 0 })
      db.shopItems.insert(fakeItem, (err, item) => cb(err, { user, company, item }))
    },
    function getShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result.name, fakeItem.name, 'Correct item is returned')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch an out-of-stock shop item if only a user', withServer((t, { server, db }) => {
  t.plan(2)

  let fakeItem

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItem ({ user, company }, cb) {
      fakeItem = fakeShopItem({ company: { _id: company._id }, stockLevel: 0 })
      db.shopItems.insert(fakeItem, (err, item) => cb(err, { user, company, item }))
    },
    function getShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch shop item if not logged in', withServer((t, { server, db }) => {
  t.plan(2)

  let fakeItem

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItem ({ user, company }, cb) {
      fakeItem = fakeShopItem({ company: { _id: company._id } })
      db.shopItems.insert(fakeItem, (err, item) => cb(err, { user, company, item }))
    },
    function getShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/item/${item._id}`
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

test('should not be able to fetch shop item if not company member', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), (err, item) => {
        cb(err, { user, company, item })
      })
    },
    function getShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/shop/item/${item._id}`,
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

test('should be able to create a new shop item', withServer((t, { server, db }) => {
  t.plan(13)

  const shopItemData = fakeShopItemPayload()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: shopItemData
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 201, 'Status code is 201')
      t.equal(res.result.name, shopItemData.name, 'Item name correct')
      t.equal(res.result.description, shopItemData.description, 'Item description correct')
      t.equal(res.result.image, shopItemData.image, 'Item image correct')
      t.equal(res.result.stockLevel, shopItemData.stockLevel, 'Item stock level correct')
      t.equal(res.result.price, shopItemData.price, 'Item price correct')
      cb(null, { res })
    },
    function findCreatedItem ({ res }, cb) {
      db.shopItems.findOne({ _id: res.result._id }, (err, item) => cb(err, { item }))
    },
    function verifyDbCreate ({ item }, cb) {
      t.ok(item, 'Item exists')
      t.equal(item.name, shopItemData.name, 'Item name correct')
      t.equal(item.description, shopItemData.description, 'Item description correct')
      t.equal(item.image, shopItemData.image, 'Item image correct')
      t.equal(item.stockLevel, shopItemData.stockLevel, 'Item stock level correct')
      t.equal(item.price, shopItemData.price, 'Item price correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to create a new shop item without description or image', withServer((t, { server, db }) => {
  t.plan(11)

  const shopItemData = fakeShopItemPayload({ description: undefined, image: undefined })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: shopItemData
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 201, 'Status code is 201')
      t.equal(res.result.name, shopItemData.name, 'Item name correct')
      t.equal(res.result.stockLevel, shopItemData.stockLevel, 'Item stock level correct')
      t.equal(res.result.price, shopItemData.price, 'Item price correct')
      cb(null, { res })
    },
    function findCreatedItem ({ res }, cb) {
      db.shopItems.findOne({ _id: res.result._id }, (err, item) => cb(err, { item }))
    },
    function verifyDbCreate ({ item }, cb) {
      t.ok(item, 'Item exists')
      t.equal(item.name, shopItemData.name, 'Item name correct')
      t.equal(item.description, shopItemData.description, 'Item description correct')
      t.equal(item.image, shopItemData.image, 'Item image correct')
      t.equal(item.stockLevel, shopItemData.stockLevel, 'Item stock level correct')
      t.equal(item.price, shopItemData.price, 'Item price correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item without a name', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ name: undefined })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item without stock level', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ stockLevel: undefined })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item without a price', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ price: undefined })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item with negative stock', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ stockLevel: -2 })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item with fractional stock', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ stockLevel: 1.138 })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item with negative price', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ price: -1 })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a shop item with fractional price', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload({ price: 11.38 })
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 400, 'Status code is 400')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a new shop item if not company moderator', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
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

test('should not be able to create a new shop item if not has role rewards', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createShopItem ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/shop/item`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
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

test('should be able to update a shop item', withServer((t, { server, db }) => {
  t.plan(9)

  const shopItemData = fakeShopItemPayload()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), (err, item) => cb(err, { user, company, item }))
    },
    function updateShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: shopItemData
      }, (res) => cb(null, { res, item }))
    },
    function verifyResponse ({ res, item }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result._id.toString(), item._id.toString(), 'Correct updated item was returned')
      cb(null, { res })
    },
    function findUpdatedItem ({ res }, cb) {
      db.shopItems.findOne({ _id: res.result._id }, (err, item) => cb(err, { item }))
    },
    function verifyDbUpdate ({ item }, cb) {
      t.ok(item, 'Item exists')
      t.equal(item.name, shopItemData.name, 'Item name correct')
      t.equal(item.description, shopItemData.description, 'Item description correct')
      t.equal(item.image, shopItemData.image, 'Item image correct')
      t.equal(item.stockLevel, shopItemData.stockLevel, 'Item stock level correct')
      t.equal(item.price, shopItemData.price, 'Item price correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to remove shop item description and image', withServer((t, { server, db }) => {
  t.plan(6)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      const itemData = fakeShopItem({
        company: { _id: company._id },
        description: 'TEST DESC',
        image: 'https://s-media-cache-ak0.pinimg.com/236x/1e/cb/e0/1ecbe0d63a3efe0e47730bcc133d8c93.jpg'
      })
      db.shopItems.insert(itemData, (err, item) => cb(err, { user, company, item }))
    },
    function updateShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: { description: null, image: null }
      }, (res) => cb(null, { res, item }))
    },
    function verifyResponse ({ res, item }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result._id.toString(), item._id.toString(), 'Correct updated item was returned')
      cb(null, { res })
    },
    function findUpdatedItem ({ res }, cb) {
      db.shopItems.findOne({ _id: res.result._id }, (err, item) => cb(err, { item }))
    },
    function verifyDbUpdate ({ item }, cb) {
      t.ok(item, 'Item exists')
      t.equal(item.description, null, 'Item description removed')
      t.equal(item.image, null, 'Item image removed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to update shop item if not exists', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function updateShopItem ({ user, company }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${new ObjectId()}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to update shop item for different company', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: new ObjectId() } })
      db.shopItems.insert(itemData, (err, item) => cb(err, { user, company, item }))
    },
    function updateShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to update shop item if not a company moderator', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id } })
      db.shopItems.insert(itemData, (err, item) => cb(err, { user, company, item }))
    },
    function updateShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
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

test('should not be able to update shop item if not has role rewards', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id } })
      db.shopItems.insert(itemData, (err, item) => cb(err, { user, company, item }))
    },
    function updateShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
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

test('should not be able to update shop item if deleted', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id }, deleted: true })
      db.shopItems.insert(itemData, (err, item) => cb(err, { user, company, item }))
    },
    function updateShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeShopItemPayload()
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to delete a shop item', withServer((t, { server, db }) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), (err, item) => cb(err, { user, company, item }))
    },
    function deleteShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res, item }))
    },
    function verifyResponse ({ res, item }, cb) {
      t.equal(res.statusCode, 204, 'Status code is 204')
      cb(null, { item })
    },
    function findUpdatedItem ({ item }, cb) {
      db.shopItems.findOne({ _id: item._id }, (err, item) => cb(err, { item }))
    },
    function verifyDbUpdate ({ item }, cb) {
      t.ok(item, 'Item exists')
      t.ok(item.deleted, 'Item deleted')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to delete a shop item if not a company moderator', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), (err, item) => cb(err, { user, company, item }))
    },
    function deleteShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/shop/item/${item._id}`,
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

test('should not be able to delete a shop item if not has role rewards', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      db.shopItems.insert(fakeShopItem({ company: { _id: company._id } }), (err, item) => cb(err, { user, company, item }))
    },
    function deleteShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/shop/item/${item._id}`,
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

test('should not be able to delete a shop item if not exists', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function updateShopItem ({ user, company }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/shop/item/${new ObjectId()}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to delete a shop item if already deleted', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addShopItem ({ user, company }, cb) {
      const itemData = fakeShopItem({ company: { _id: company._id }, deleted: true })
      db.shopItems.insert(itemData, (err, item) => cb(err, { user, company, item }))
    },
    function deleteShopItem ({ user, company, item }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/shop/item/${item._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 404, 'Status code is 404')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
