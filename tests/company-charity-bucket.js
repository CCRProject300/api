const test = require('tape')
const Async = require('async')
const ObjectId = require('mongojs').ObjectId
const Faker = require('faker')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const fakeCompany = require('./helpers/fake-company')
const { fakeMember, fakeModerator } = fakeCompany
const fakeCharityBucket = require('./helpers/fake-charity-bucket')
const fakeCharityBucketPayload = require('./helpers/fake-charity-bucket-payload')

test('should be able to get charity bucket', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const data = fakeCharityBucket({ company: { _id: company._id } })
      db.charityBuckets.insert(data, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function getBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to get charity bucket if not exists', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function getBucket ({ user, company }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/bucket/${ObjectId()}`,
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

test('should not be able to get charity bucket if not logged in', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const data = fakeCharityBucket({ company: { _id: company._id } })
      db.charityBuckets.insert(data, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function getBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`
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

test('should not be able to fetch charity bucket if not company member', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany()
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), (err, bucket) => {
        cb(err, { user, company, bucket })
      })
    },
    function getBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'GET',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
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

test('should be able to create a new charity bucket', withServer((t, { server, db }) => {
  t.plan(17)

  const bucketData = fakeCharityBucketPayload()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: bucketData
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 201, 'Status code is 201')
      t.equal(res.result.name, bucketData.name, 'Bucket name correct')
      t.equal(res.result.description, bucketData.description, 'Bucket description correct')
      t.equal(res.result.image, bucketData.image, 'Bucket image correct')
      t.equal(res.result.logo, bucketData.logo, 'Bucket logo correct')
      t.equal(res.result.target, bucketData.target, 'Bucket target correct')
      t.equal(res.result.autoClose, bucketData.autoClose, 'Bucket auto close value correct')
      t.equal(res.result.closed, bucketData.closed, 'Bucket closed value correct')
      cb(null, { res })
    },
    function findCreatedBucket ({ res }, cb) {
      db.charityBuckets.findOne({ _id: res.result._id }, (err, bucket) => cb(err, { bucket }))
    },
    function verifyDbCreate ({ bucket }, cb) {
      t.ok(bucket, 'Bucket exists')
      t.equal(bucket.name, bucketData.name, 'Bucket name correct')
      t.equal(bucket.description, bucketData.description, 'Bucket description correct')
      t.equal(bucket.image, bucketData.image, 'Bucket image correct')
      t.equal(bucket.logo, bucketData.logo, 'Bucket logo correct')
      t.equal(bucket.target, bucketData.target, 'Bucket target correct')
      t.equal(bucket.autoClose, bucketData.autoClose, 'Bucket auto close value correct')
      t.equal(bucket.closed, bucketData.closed, 'Bucket closed value correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to create a new charity bucket without description, image, logo, autoClose or closed', withServer((t, { server, db }) => {
  t.plan(17)

  const bucketData = fakeCharityBucketPayload({
    description: undefined,
    image: undefined,
    logo: undefined,
    autoClose: undefined,
    closed: undefined
  })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: bucketData
      }, (res) => cb(null, { res }))
    },
    function verifyResponse ({ res }, cb) {
      t.equal(res.statusCode, 201, 'Status code is 201')
      t.equal(res.result.name, bucketData.name, 'Bucket name correct')
      t.equal(res.result.description, undefined, 'Bucket description correct')
      t.equal(res.result.image, undefined, 'Bucket image correct')
      t.equal(res.result.logo, undefined, 'Bucket logo correct')
      t.equal(res.result.target, bucketData.target, 'Bucket target correct')
      t.equal(res.result.autoClose, false, 'Bucket auto close value correct')
      t.equal(res.result.closed, false, 'Bucket closed value correct')
      cb(null, { res })
    },
    function findCreatedBucket ({ res }, cb) {
      db.charityBuckets.findOne({ _id: res.result._id }, (err, bucket) => cb(err, { bucket }))
    },
    function verifyDbCreate ({ bucket }, cb) {
      t.ok(bucket, 'Bucket exists')
      t.equal(bucket.name, bucketData.name, 'Bucket name correct')
      t.equal(bucket.description, undefined, 'Bucket description correct')
      t.equal(bucket.image, undefined, 'Bucket image correct')
      t.equal(bucket.logo, undefined, 'Bucket logo correct')
      t.equal(bucket.target, bucketData.target, 'Bucket target correct')
      t.equal(bucket.autoClose, false, 'Bucket auto close value correct')
      t.equal(bucket.closed, false, 'Bucket closed value correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to create a charity bucket without a name', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload({ name: undefined })
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

test('should not be able to create a charity bucket without target', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload({ target: undefined })
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

test('should not be able to create a charity bucket with negative target', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload({ target: -2 })
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

test('should not be able to create a charity bucket with fractional target', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload({ target: 1.138 })
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

test('should not be able to create a new charity bucket if not company moderator', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function createCharityBucket ({ user, company }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload()
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

test('should be able to update a charity bucket', withServer((t, { server, db }) => {
  t.plan(11)

  const bucketData = fakeCharityBucketPayload({ closed: Faker.random.boolean() })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), (err, bucket) => cb(err, { user, company, bucket }))
    },
    function updateBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: bucketData
      }, (res) => cb(null, { res, bucket }))
    },
    function verifyResponse ({ res, bucket }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result._id.toString(), bucket._id.toString(), 'Correct updated bucket was returned')
      cb(null, { res })
    },
    function findUpdatedBucket ({ res }, cb) {
      db.charityBuckets.findOne({ _id: res.result._id }, (err, bucket) => cb(err, { bucket }))
    },
    function verifyDbUpdate ({ bucket }, cb) {
      t.ok(bucket, 'Bucket exists')
      t.equal(bucket.name, bucketData.name, 'Bucket name correct')
      t.equal(bucket.description, bucketData.description, 'Bucket description correct')
      t.equal(bucket.image, bucketData.image, 'Bucket image correct')
      t.equal(bucket.logo, bucketData.logo, 'Bucket logo correct')
      t.equal(bucket.target, bucketData.target, 'Bucket target correct')
      t.equal(bucket.autoClose, bucketData.autoClose, 'Bucket auto close correct')
      t.equal(bucket.closed, bucketData.closed, 'Bucket closed correct')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should be able to remove charity bucket description, image and logo', withServer((t, { server, db }) => {
  t.plan(7)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const bucketData = fakeCharityBucket({
        company: { _id: company._id },
        description: 'TEST DESC',
        image: 'https://s-media-cache-ak0.pinimg.com/236x/1e/cb/e0/1ecbe0d63a3efe0e47730bcc133d8c93.jpg'
      })
      db.charityBuckets.insert(bucketData, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function updateBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: { description: null, image: null, logo: null }
      }, (res) => cb(null, { res, bucket }))
    },
    function verifyResponse ({ res, bucket }, cb) {
      t.equal(res.statusCode, 200, 'Status code is 200')
      t.equal(res.result._id.toString(), bucket._id.toString(), 'Correct updated bucket was returned')
      cb(null, { res })
    },
    function findUpdatedBucket ({ res }, cb) {
      db.charityBuckets.findOne({ _id: res.result._id }, (err, bucket) => cb(err, { bucket }))
    },
    function verifyDbUpdate ({ bucket }, cb) {
      t.ok(bucket, 'Bucket exists')
      t.equal(bucket.description, null, 'Bucket description removed')
      t.equal(bucket.image, null, 'Bucket image removed')
      t.equal(bucket.logo, null, 'Bucket logo removed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to update charity bucket if not exists', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function updateBucket ({ user, company }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${new ObjectId()}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload()
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

test('should not be able to update charity bucket for different company', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const bucketData = fakeCharityBucket({ company: { _id: new ObjectId() } })
      db.charityBuckets.insert(bucketData, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function updateBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload()
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

test('should not be able to update charity bucket if not a company moderator', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const bucketData = fakeCharityBucket({ company: { _id: company._id } })
      db.charityBuckets.insert(bucketData, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function updateBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload()
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

test('should not be able to update charity bucket if not has role charity rewards', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const bucketData = fakeCharityBucket({ company: { _id: company._id } })
      db.charityBuckets.insert(bucketData, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function updateBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload()
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

test('should not be able to update charity bucket if deleted', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const bucketData = fakeCharityBucket({ company: { _id: company._id }, deleted: true })
      db.charityBuckets.insert(bucketData, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function updateBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'PATCH',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) },
        payload: fakeCharityBucketPayload()
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

test('should be able to delete a charity bucket', withServer((t, { server, db }) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), (err, bucket) => cb(err, { user, company, bucket }))
    },
    function deleteBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
        headers: { authorization: getToken(user.authData) }
      }, (res) => cb(null, { res, bucket }))
    },
    function verifyResponse ({ res, bucket }, cb) {
      t.equal(res.statusCode, 204, 'Status code is 204')
      cb(null, { bucket })
    },
    function findUpdatedBucket ({ bucket }, cb) {
      db.charityBuckets.findOne({ _id: bucket._id }, (err, bucket) => cb(err, { bucket }))
    },
    function verifyDbUpdate ({ bucket }, cb) {
      t.ok(bucket, 'Bucket exists')
      t.ok(bucket.deleted, 'Bucket deleted')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('should not be able to delete a charity bucket if not a company moderator', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), (err, bucket) => cb(err, { user, company, bucket }))
    },
    function deleteBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
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

test('should not be able to delete a charity bucket if not has role charity rewards', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ members: [fakeMember({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      db.charityBuckets.insert(fakeCharityBucket({ company: { _id: company._id } }), (err, bucket) => cb(err, { user, company, bucket }))
    },
    function deleteBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
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

test('should not be able to delete a charity bucket if not exists', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function updateBucket ({ user, company }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/charity/bucket/${new ObjectId()}`,
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

test('should not be able to delete a charity bucket if already deleted', withServer((t, { server, db }) => {
  t.plan(2)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, { roles: ['corporate_mod', 'charity-rewards'] }, cb),
    function addCompany (user, cb) {
      const companyData = fakeCompany({ moderators: [fakeModerator({ user: user._id })] })
      db.companies.insert(companyData, (err, company) => cb(err, { user, company }))
    },
    function addBucket ({ user, company }, cb) {
      const bucketData = fakeCharityBucket({ company: { _id: company._id }, deleted: true })
      db.charityBuckets.insert(bucketData, (err, bucket) => cb(err, { user, company, bucket }))
    },
    function deleteBucket ({ user, company, bucket }, cb) {
      server.inject({
        method: 'DELETE',
        url: `/company/${company._id}/charity/bucket/${bucket._id}`,
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
