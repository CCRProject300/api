const test = require('tape')
const Request = require('request')
const Async = require('async')
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const authUser = require('./helpers/auth-user')

let serverUrl = null
let db = null

test('Start server', (t) => {
  t.plan(1)
  Server.start((err, ctx) => {
    t.ifError(err, 'Server started successfully')
    serverUrl = ctx.server.info.uri
    db = ctx.db
    t.end()
  })
})

test('Should cascade deleting a location', (t) => {
  t.plan(4)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => {
      Async.parallel({
        admin: (done) => {
          addUser(db, {roles: ['admin']}, done)
        },
        member: (done) => {
          addUser(db, {
            roles: ['user'],
            location: 'loc1',
            companyName: 'test company'
          }, done)
        }
      }, cb)
    },
    (users, cb) => {
      addCompany(db, {
        users: [users.member, users.admin],
        locations: ['loc1', 'loc2'],
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
    function deleteCall (token, company, users, cb) {
      Request.delete({
        url: `${serverUrl}/admin/company/${company._id}/locations/${encodeURIComponent(company.locations[0])}`,
        json: true,
        headers: { authorization: token }
      }, (err, res) => {
        t.equals(res.statusCode, 204, 'ok responds with 204 no content')
        cb(err, users, company)
      })
    },
    (users, company, cb) => {
      Async.parallel({
        company: (done) => db.companies.findOne({_id: company._id}, done),
        user: (done) => db.users.findOne({ _id: users.member._id }, done)
      }, cb)
    }
  ], (err, results) => {
    t.ifError(err, 'no errors')
    t.notOk(results.user.location, 'location removed from user')
    t.ok(results.company.locations.indexOf('loc1') === -1, 'and the company too')
    t.end()
  })
})

test('Should be able to add a new location', (t) => {
  t.plan(3)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function addNewLocation (token, company, users, cb) {
      Request.put({
        url: `${serverUrl}/admin/company/${company._id}/locations/${encodeURIComponent('new location')}`,
        json: true,
        headers: { authorization: token }
      }, (err, res) => {
        if (err) return cb(err)
        t.equal(res.statusCode, 201, '201 location created')
        db.companies.findOne({ _id: company._id }, cb)
      })
    }
  ], (err, company) => {
    t.ifError(err, 'no errors')
    t.equal(company.locations.pop(), 'new location', 'New location found on company object')
    t.end()
  })
})

test('Should be able to add a new location if non exists', (t) => {
  t.plan(4)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    (company, users, cb) => {
      db.companies.update({_id: company._id}, {$unset: {locations: 1}}, (err) => {
        if (err) return cb(err)
        db.companies.findOne({_id: company._id}, (err, company) => {
          cb(err, company, users)
        })
      })
    },
    function authAsAdminRole (company, users, cb) {
      t.notOk(company.locations, 'removes the company\'s locations property')
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function addNewLocation (token, company, users, cb) {
      Request.put({
        url: `${serverUrl}/admin/company/${company._id}/locations/${encodeURIComponent('new location')}`,
        json: true,
        headers: { authorization: token }
      }, (err, res) => {
        if (err) return cb(err)
        t.equal(res.statusCode, 201, '201 location created')
        db.companies.findOne({ _id: company._id }, cb)
      })
    }
  ], (err, company) => {
    t.ifError(err, 'no errors')
    t.equal(company.locations.pop(), 'new location', 'New location found on company object')
    t.end()
  })
})

test('Should NOT add a new location if one already exists', (t) => {
  t.plan(2)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    (users, cb) => {
      addCompany(db, {
        users: [users.corporate_mod, users.admin],
        locations: ['loc1']
      }, (err, company) => {
        cb(err, company, users)
      })
    },
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function addNewLocation (token, company, users, cb) {
      Request.put({
        url: `${serverUrl}/admin/company/${company._id}/locations/loc1`,
        json: true,
        headers: { authorization: token }
      }, cb)
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 409, '409 conflict location exists')
    t.end()
  })
})

test('Should be able to update a location', (t) => {
  t.plan(5)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => {
      Async.parallel({
        admin: (done) => {
          addUser(db, {
            roles: ['admin'],
            location: 'loc 1',
            companyName: 'test company'
          }, done)
        },
        member: (done) => {
          addUser(db, {
            roles: ['user'],
            location: 'loc 1',
            companyName: 'test company'
          }, done)
        }
      }, cb)
    },
    (users, cb) => {
      addCompany(db, {
        users: [users.member, users.admin],
        locations: ['loc 1', 'loc 2'],
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
    function addNewLocation (token, company, users, cb) {
      const location = company.locations[0]
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}/locations/${location}`,
        json: true,
        headers: { authorization: token },
        body: {
          location: 'NEW LOCATION 1'
        }
      }, (err, res) => {
        if (err) return cb(err)
        const responseHeaders = res.headers.location
        const newResource = `/admin/company/${company._id}/locations/${encodeURIComponent('NEW LOCATION 1')}`
        t.equal(res.statusCode, 204, '204 location created nothing returned')
        t.equal(responseHeaders, newResource, 'responds with new resource location')
        db.companies.findOne({ _id: company._id }, cb)
      })
    },
    (company, cb) => {
      t.ok(company.locations.indexOf('NEW LOCATION 1') >= 0, 'New location found on company object')
      db.users.find({companyName: company.name}, cb)
    }
  ], (err, users) => {
    const locations = users.map((user) => user.location)
    t.ifError(err, 'no errors')
    t.same(locations, ['NEW LOCATION 1', 'NEW LOCATION 1'], 'location prop updated for all users')
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
