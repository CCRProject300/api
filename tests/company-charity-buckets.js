const test = require('tape')
const Async = require('async')
const Faker = require('faker')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const fakeCompany = require('./helpers/fake-company')
const { fakeMember } = fakeCompany
const fakeCharityBucket = require('./helpers/fake-charity-bucket')

test('should be able to fetch all charity buckets', withServer((t, { server, db }) => {
  t.plan(3)

  const TOTAL_BUCKETS = Faker.random.number({ min: 1, max: 10 })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBuckets ({ user, company }, cb) {
      Async.times(TOTAL_BUCKETS, (_, cb) => {
        db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    // Also add a deleted bucket
    function addDeletedBucket ({ user, company }, cb) {
      const itemData = fakeCharityBucket({ company: { _id: company._id }, deleted: true })
      db.charityBuckets.insert(itemData, (err) => cb(err, { user, company }))
    },
    // Also add a bucket not belonging to this company
    function addOtherCharityBucket ({ user, company }, cb) {
      db.charityBuckets.insert(fakeCharityBucket(), (err) => cb(err, { user, company }))
    },
    function getCharityBuckets ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/buckets`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result.length, TOTAL_BUCKETS, 'All charity buckets retrieved')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to fetch charity buckets if not logged in', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addCompany (cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { company }))
    },
    function addBuckets ({ company }, cb) {
      Async.times(Faker.random.number({ min: 1, max: 100 }), (_, cb) => {
        db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { company }))
    },
    function getCharityBuckets ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/buckets`
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

test('should not be able to fetch charity buckets if not company member', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBuckets ({ user, company }, cb) {
      Async.times(Faker.random.number({ min: 1, max: 100 }), (_, cb) => {
        db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getCharityBuckets ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/buckets`,
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

test('should not be able to fetch charity buckets if not has charity rewards role', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBuckets ({ user, company }, cb) {
      Async.times(Faker.random.number({ min: 1, max: 100 }), (_, cb) => {
        db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), cb)
      }, (err) => cb(err, { user, company }))
    },
    function getCharityBuckets ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/buckets`,
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
