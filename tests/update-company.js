const test = require('tape')
const Request = require('request')
const Async = require('async')
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const authUser = require('./helpers/auth-user')
const sinon = require('sinon')

let serverUrl = null
let db = null

const uploadcare = {
  store: (uuid, cb) => cb && cb()
}

const storeSpy = sinon.spy(uploadcare, 'store')

test('Start server', (t) => {
  t.plan(1)
  Server.start({uploadcare}, (err, ctx) => {
    t.ifError(err, 'Server started successfully')
    serverUrl = ctx.server.info.uri
    db = ctx.db
    t.end()
  })
})

test('Should be able to get a company', (t) => {
  t.plan(6)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    (company, users, cb) => {
      t.ok(company.name, 'created a company ok - now try to get it')
      Request.get({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        header: { authorization: null }
      }, (err, res, body) => {
        t.equal(res.statusCode, 401, 'you have to have an authorization token')
        cb(err, company, users)
      })
    },
    function authAsNonAdminRole (company, users, cb) {
      authUser(serverUrl, users.corporate_mod.authData, (err, unauthorizedToken) => {
        cb(err, unauthorizedToken, company, users)
      })
    },
    function loginCorporateModarator (unauthorizedToken, company, users, cb) {
      Request.get({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: unauthorizedToken }
      }, (err, res) => {
        t.equal(res.statusCode, 403, 'you have to have an admins authorization token')
        cb(err, company, users)
      })
    },
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function nowLoginAdminUser (token, company, users, cb) {
      Request.get({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token }
      }, (err, res, body) => {
        t.equal(res.statusCode, 200, 'when you are an admin you get a 200')
        t.equal(body.name, company.name, 'and you get the company')
        cb(err)
      })
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should be able to update a company', (t) => {
  t.plan(4)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function nowLoginAdminUser (token, company, users, cb) {
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token },
        body: {
          name: 'New test name'
        }
      }, (err, res) => {
        if (err) return cb(err)
        t.equal(res.statusCode, 200, 'admins can send edited company values')
        Request.get({
          url: `${serverUrl}/admin/company/${company._id}`,
          json: true,
          headers: { authorization: token }
        }, (err, res, body) => cb(err, body, company))
      })
    }
  ], (err, body, company) => {
    t.notEqual(body.name, company.name, 'and change those values')
    t.equal(body.name, 'New test name', 'too new values')
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should update users when company name changes', (t) => {
  t.plan(2)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => {
      Async.parallel({
        admin: (done) => addUser(db, {roles: ['admin'], companyName: 'test company'}, done),
        member: (done) => addUser(db, {roles: ['user'], companyName: 'test company'}, done)
      }, cb)
    },
    (users, cb) => {
      addCompany(db, {
        users: [users.member, users.admin],
        name: 'test company'
      }, (err, company) => {
        cb(err, company, users)
      })
    },
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function nowSendUpdate (token, company, users, cb) {
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token },
        body: {
          name: 'New Company Name'
        }
      }, (err, res) => {
        cb(err, company, [users.admin, users.member])
      })
    },
    (company, users, cb) => {
      const userIds = users.map((user) => user._id)
      Async.parallel({
        company: (done) => db.companies.findOne({_id: company._id}, done),
        users: (done) => db.users.find({_id: {$in: userIds}}, done)
      }, cb)
    }
  ], (err, results) => {
    t.equal(results.users[0].companyName, results.company.name, 'users updated when company name changes')
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should update user roles when company roles are changed', (t) => {
  t.plan(2)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => {
      Async.parallel({
        admin: (done) => addUser(db, {roles: ['admin'], companyName: 'test company'}, done),
        corpMod: (done) => addUser(db, {roles: ['corporate_mod'], companyName: 'test company'}, done),
        member: (done) => addUser(db, {roles: ['user', 'roleA'], companyName: 'test company'}, done)
      }, cb)
    },
    (users, cb) => {
      addCompany(db, {
        users: [users.corpMod, users.member],
        name: 'test company',
        roles: ['roleA']
      }, (err, company) => {
        cb(err, company, users)
      })
    },
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users.member)
      })
    },
    function nowSendUpdate (token, company, member, cb) {
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token },
        body: {
          roles: ['roleB']
        }
      }, (err, res) => {
        cb(err, company, member)
      })
    },
    (company, member, cb) => {
      db.users.findOne({ _id: member._id }, cb)
    }
  ], (err, member) => {
    t.deepEqual(member.roles, ['user', 'roleB'], 'user\'s roles updated when company roles updated')
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should be able to store an uploadcare image', (t) => {
  t.plan(2)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function nowLoginAdminUser (token, company, users, cb) {
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token },
        body: {
          logo: 'http://new/uploadcare/url'
        }
      }, (err, res) => {
        t.ok(storeSpy.called, 'uploadcare store was called ok')
        cb(err)
      })
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    storeSpy.reset()
    t.end()
  })
})

test('Should only store an uploadcare image that has changed', (t) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function nowLoginAdminUser (token, company, users, cb) {
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token },
        body: {
          name: 'new company name'
        }
      }, (err, res) => {
        t.notOk(storeSpy.called, 'uploadcare store was NOT called')
        cb(err)
      })
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    storeSpy.reset()
    t.end()
  })
})

test('Should NOT be able to update locations', (t) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function nowLoginAdminUser (token, company, users, cb) {
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}`,
        json: true,
        headers: { authorization: token },
        body: {
          locations: ['some', 'locations']
        }
      }, (err, res) => {
        t.equal(res.statusCode, 400, '400 bad request updating locations here')
        cb(err)
      })
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Stop server', (t) => {
  t.plan(1)
  Server.stop((err, ctx) => {
    t.ifError(err, 'Server stopped successfully')
    t.end()
  })
})

function addAdminUser (cb) {
  Async.parallel({
    admin: (done) => {
      addUser(db, {roles: ['admin']}, done)
    },
    corporate_mod: (done) => {
      addUser(db, {roles: ['corporate_mod']}, done)
    }
  }, cb)
}

function createCompany (users, cb) {
  addCompany(db, {users: [users.corporate_mod, users.admin]}, (err, company) => {
    cb(err, company, users)
  })
}
