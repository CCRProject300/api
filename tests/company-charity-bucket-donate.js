const test = require('tape')
const Async = require('async')
const Sinon = require('sinon')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const addCompany = require('./helpers/add-company')
const fakeCharityBucket = require('./helpers/fake-charity-bucket')

test('Should be able to donate to a bucket', withServer((t, { server, db }) => {
  t.plan(6)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 10, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        donations: []
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 10 }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        Async.parallel({
          bucket: (cb) => db.charityBuckets.findOne({ _id: bucket._id }, cb),
          user: (cb) => db.users.findOne({ _id: member._id }, cb),
          transaction: (cb) => db.transactionLogs.findOne({ 'data.bucket._id': bucket._id }, cb)
        }, cb)
      })
    },
    function checkResults ({ bucket, user, transaction }, cb) {
      t.equal(bucket.total, 10, 'Bucket donation total was updated')
      t.equal(bucket.donations.length, 1, 'Bucket donations log was updated')
      t.equal(user.kudosCoins, 1, 'User KudosCoins level is reduced') // remember you get a coin for visiting the site
      t.ok(transaction, 'Transaction log was added')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to donate to a charity bucket which is closed', withServer((t, { server, db }) => {
  t.plan(2)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 10, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        closed: true
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 4 }
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

test('Should not be able to donate to a charity bucket if not has role charity rewards', withServer((t, { server, db }) => {
  t.plan(2)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 10 })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({ company: { _id: company._id } })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 4 }
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

test('Should not be able to donate to a charity bucket with insufficient kudosCoins', withServer((t, { server, db }) => {
  t.plan(2)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 1, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({ company: { _id: company._id } })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 25 }
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

test('Should not be able to donate more than target amount to a charity bucket if auto close is enabled', withServer((t, { server, db }) => {
  t.plan(2)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 5000, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        target: 100,
        autoClose: true
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 138 }
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

test('Should be able to donate more than target amount to a charity bucket if auto close is disabled', withServer((t, { server, db }) => {
  t.plan(2)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 5000, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        target: 100,
        autoClose: false
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 138 }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to donate to a bucket belonging to a different company', withServer((t, { server, db }) => {
  t.plan(2)

  // create 2 users
  // - user[0] is the company mod of both companies
  // - user[1] is a company member of company A ONLY
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 1, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addSecondCompany ({ users, company: companyA }, cb) {
      addCompany(db, { users: users.slice(0, 1) }, (err, companyB) => {
        cb(err, { users, companyA, companyB })
      })
    },
    function addBucket ({ users, companyA, companyB }, cb) {
      const data = fakeCharityBucket({
        company: { _id: companyB._id },
        stockLevel: 1,
        price: 2
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company: companyA, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 1 }
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
  t.plan(4)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  const spy = Sinon.spy(mailer, 'send')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 10, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users, name: 'test company' }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({ company: { _id: company._id } })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(users[1]) },
        payload: { amount: 1 }
      }, (res) => cb(null, res, users))
    }
  ], (err, res, users) => {
    t.ifError(err, 'No error')
    t.equal(res.statusCode, 200)
    t.equal(spy.callCount, 1, 'email receipt has been sent')
    t.ok(spy.calledWith('user-charity-bucket-donation-receipt', users[1].emails[0].address))
    db.close()
    t.end()
  })
}))

test('Should send target reached emails to donators', withServer((t, { server, db, mailer }) => {
  t.plan(4)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  const spy = Sinon.spy(mailer, 'send')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 1000, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users, name: 'test company' }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        target: 100,
        autoClose: false
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(users[1]) },
        payload: { amount: 138 }
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'No error')
    t.ok(res.statusCode, 200)
    t.ok(spy.called, 'Target reached email has been sent')
    t.ok(spy.calledWith('user-charity-bucket-target-reached'))
    db.close()
    t.end()
  })
}))

test('Should send target reached emails to company moderators', withServer((t, { server, db, mailer }) => {
  t.plan(4)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  const spy = Sinon.spy(mailer, 'send')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db, { kudosCoins: 1000, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users, name: 'test company' }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        target: 100,
        autoClose: false
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(users[1]) },
        payload: { amount: 138 }
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'No error')
    t.ok(res.statusCode, 200)
    t.ok(spy.called, 'Target reached email has been sent')
    t.ok(spy.calledWith('moderator-charity-bucket-target-reached'))
    db.close()
    t.end()
  })
}))

test('Should auto close a bucket when target reached', withServer((t, { server, db }) => {
  t.plan(3)

  // create 2 users and add them to a company
  // - user[0] is the company mod
  // - user[1] is a company member
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(null, db),
      addUser.bind(null, db, { kudosCoins: 10, roles: ['charity-rewards'] })
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    function addBucket ({ users, company }, cb) {
      const data = fakeCharityBucket({
        company: { _id: company._id },
        donations: [],
        target: 5,
        autoClose: true
      })

      db.charityBuckets.insert(data, (err, bucket) => {
        cb(err, { users, company, bucket })
      })
    },
    function donate ({ users, company, bucket }, cb) {
      const member = users[1]

      server.inject({
        method: 'POST',
        url: `/company/${company._id}/charity/bucket/${bucket._id}/donate`,
        headers: { authorization: getToken(member) },
        payload: { amount: 5 }
      }, (res) => {
        t.equal(res.statusCode, 200, 'Status code is 200')
        cb(null, { bucket })
      })
    },
    function findUpdatedBucket ({ bucket }, cb) {
      db.charityBuckets.findOne({ _id: bucket._id }, cb)
    },
    function checkBucket (bucket, cb) {
      t.equal(bucket.closed, true, 'Bucket closed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
