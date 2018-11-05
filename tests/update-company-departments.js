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

test('Should cascade deleting a department', (t) => {
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
            department: 'dept1',
            companyName: 'test company'
          }, done)
        }
      }, cb)
    },
    (users, cb) => {
      addCompany(db, {
        users: [users.member, users.admin],
        departments: ['dept1', 'dept2'],
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
        url: `${serverUrl}/admin/company/${company._id}/departments/${encodeURIComponent(company.departments[0])}`,
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
    t.notOk(results.user.department, 'department removed from user')
    t.ok(results.company.departments.indexOf('dept1') === -1, 'and the company too')
    t.end()
  })
})

test('Should be able to add a new department', (t) => {
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
    function addNewDepartment (token, company, users, cb) {
      Request.put({
        url: `${serverUrl}/admin/company/${company._id}/departments/${encodeURIComponent('new company department')}`,
        json: true,
        headers: { authorization: token }
      }, (err, res) => {
        if (err) return cb(err)
        t.equal(res.statusCode, 201, '201 department created')
        db.companies.findOne({ _id: company._id }, cb)
      })
    }
  ], (err, company) => {
    t.ifError(err, 'no errors')
    t.equal(company.departments.pop(), 'new company department', 'New department found on company object')
    t.end()
  })
})

test('Should be able to add a new department if non exist on the company object', (t) => {
  t.plan(4)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    createCompany,
    (company, users, cb) => {
      db.companies.update({_id: company._id}, {$unset: {departments: 1}}, (err) => {
        if (err) return cb(err)
        db.companies.findOne({_id: company._id}, (err, company) => {
          cb(err, company, users)
        })
      })
    },
    function authAsAdminRole (company, users, cb) {
      t.notOk(company.departments, 'removes the companies departments property')
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function addNewDepartment (token, company, users, cb) {
      Request.put({
        url: `${serverUrl}/admin/company/${company._id}/departments/${'new company department'}`,
        json: true,
        headers: { authorization: token }
      }, (err, res) => {
        if (err) return cb(err)
        t.equal(res.statusCode, 201, '201 department created')
        db.companies.findOne({ _id: company._id }, cb)
      })
    }
  ], (err, company) => {
    t.ifError(err, 'no errors')
    t.equal(company.departments.pop(), 'new company department', 'New department found on company object')
    t.end()
  })
})

test('Should NOT add a new department if one already exists', (t) => {
  t.plan(2)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    addAdminUser,
    (users, cb) => {
      addCompany(db, {
        users: [users.corporate_mod, users.admin],
        departments: ['dept1']
      }, (err, company) => {
        cb(err, company, users)
      })
    },
    function authAsAdminRole (company, users, cb) {
      authUser(serverUrl, users.admin.authData, (err, token) => {
        cb(err, token, company, users)
      })
    },
    function addNewDepartment (token, company, users, cb) {
      Request.put({
        url: `${serverUrl}/admin/company/${company._id}/departments/dept1`,
        json: true,
        headers: { authorization: token }
      }, cb)
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 409, '409 conflict department exists')
    t.end()
  })
})

test('Should be able to update a department', (t) => {
  t.plan(5)
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => {
      Async.parallel({
        admin: (done) => {
          addUser(db, {
            roles: ['admin'],
            department: 'dept 1',
            companyName: 'test company'
          }, done)
        },
        member: (done) => {
          addUser(db, {
            roles: ['user'],
            department: 'dept 1',
            companyName: 'test company'
          }, done)
        }
      }, cb)
    },
    (users, cb) => {
      addCompany(db, {
        users: [users.member, users.admin],
        departments: ['dept 1', 'dept 2'],
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
    function addNewDepartment (token, company, users, cb) {
      const department = company.departments[0]
      Request.patch({
        url: `${serverUrl}/admin/company/${company._id}/departments/${department}`,
        json: true,
        headers: { authorization: token },
        body: {
          department: 'NEW DEPARTMENT 1'
        }
      }, (err, res) => {
        if (err) return cb(err)
        const responseHeaders = res.headers.location
        const newResource = `/admin/company/${company._id}/departments/${encodeURIComponent('NEW DEPARTMENT 1')}`
        t.equal(res.statusCode, 204, '204 department created nothing returned')
        t.equal(responseHeaders, newResource, 'responds with new resource location')
        db.companies.findOne({ _id: company._id }, cb)
      })
    },
    (company, cb) => {
      t.ok(company.departments.indexOf('NEW DEPARTMENT 1') >= 0, 'New department found on company object')
      db.users.find({companyName: company.name}, cb)
    }
  ], (err, users) => {
    const departments = users.map((user) => user.department)
    t.ifError(err, 'no errors')
    t.same(departments, ['NEW DEPARTMENT 1', 'NEW DEPARTMENT 1'], 'department updated for all users')
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
