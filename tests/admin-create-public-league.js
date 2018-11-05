const test = require('tape')
const Async = require('async')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const { getToken } = require('./helpers/auth-user')
const { fakePublicLeaguePayload } = require('./helpers/fake-public-league')
const Sinon = require('sinon')

test('Non Admins should NOT be able to create a public league', withServer((t, { server, uploadcare, db }) => {
  t.plan(3)

  const uploadcareStoreSpy = Sinon.spy(uploadcare, 'store')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, {roles: ['corporate_mod']}, cb),
    (user, cb) => {
      server.inject({
        method: 'POST',
        url: '/admin/league',
        headers: { authorization: getToken(user.authData) },
        payload: fakePublicLeaguePayload()
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 403, '403 Forbidden')
    t.notOk(uploadcareStoreSpy.called)
    db.close()
    t.end()
  })
}))

test('Admins should be able to create a branded league', withServer((t, { server, uploadcare, db }) => {
  t.plan(9)

  const payload = fakePublicLeaguePayload()
  const uploadcareStoreSpy = Sinon.spy(uploadcare, 'store')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, {roles: ['admin']}, cb),
    (user, cb) => {
      server.inject({
        method: 'POST',
        url: '/admin/league',
        headers: { authorization: getToken(user.authData) },
        payload
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 201, 'created OK')
    t.ok(res.result.public)
    t.notOk(res.result.deleted)
    t.ok(res.result.members)
    t.equal(res.result.moderators.length, 1)
    t.ok(Array.isArray(res.result.panel))
    t.equal(uploadcareStoreSpy.callCount, 1)
    const { name, description, startDate, endDate, teamSize, minTeamSize, branding } = res.result
    t.same(payload, { name, description, startDate, endDate, teamSize, minTeamSize, branding })
    db.close()
    t.end()
  })
}))

test('Admins should be able to update a branded league', withServer((t, { server, uploadcare, db }) => {
  t.plan(5)

  const uploadcareStoreSpy = Sinon.spy(uploadcare, 'store')
  const uploadcareRemoveSpy = Sinon.spy(uploadcare, 'remove')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, {roles: ['admin']}, cb),
    (user, cb) => {
      const token = getToken(user.authData)

      server.inject({
        method: 'POST',
        url: '/admin/league',
        headers: { authorization: token },
        payload: fakePublicLeaguePayload()
      }, (res) => {
        // reset call to 'store' on create league
        uploadcareStoreSpy.reset()
        cb(null, res.result, token)
      })
    },
    (league, token, cb) => {
      server.inject({
        method: 'PATCH',
        url: `/admin/league/${league._id}`,
        headers: { authorization: token },
        payload: {
          branding: {
            title: 'test update title',
            logo: 'https://ucarecdn.com/uuid/new.jpg'
          }
        }
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 200, 'ok 200 reply')
    t.equal(res.result.branding.title, 'test update title', 'updates title ok')
    t.equal(uploadcareStoreSpy.callCount, 1, 'calls store for new image')
    t.equal(uploadcareRemoveSpy.callCount, 1, 'calls remove for old image')
    db.close()
    t.end()
  })
}))

test('Admins should be able to delete a branded league', withServer((t, { server, uploadcare, db }) => {
  t.plan(4)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, {roles: ['admin']}, cb),
    (user, cb) => {
      const token = getToken(user.authData)

      server.inject({
        method: 'POST',
        url: '/admin/league',
        headers: { authorization: token },
        payload: fakePublicLeaguePayload()
      }, (res) => cb(null, res, res.result, token))
    },
    (res, league, token, cb) => {
      t.equal(res.statusCode, 201)

      server.inject({
        method: 'DELETE',
        url: `/admin/league/${league._id}`,
        headers: { authorization: token }
      }, (res) => cb(null, res, league, token))
    },
    (res, league, token, cb) => {
      t.equal(res.statusCode, 200)

      server.inject({
        method: 'GET',
        url: `/league/${league._id}`,
        headers: { authorization: token }
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 404)
    db.close()
    t.end()
  })
}))

test('Should be able to get a branded league', withServer((t, { server, uploadcare, db }) => {
  t.plan(4)

  const payload = fakePublicLeaguePayload()

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => addUser(db, {roles: ['admin']}, cb),
    (user, cb) => {
      const token = getToken(user.authData)

      server.inject({
        method: 'POST',
        url: '/admin/league',
        headers: { authorization: token },
        payload
      }, (res) => cb(null, res, res.result, token))
    },
    (res, league, token, cb) => {
      t.equal(res.statusCode, 201)

      server.inject({
        method: 'GET',
        url: `/league/${league._id}`,
        headers: { authorization: token }
      }, (res) => cb(null, res))
    }
  ], (err, res) => {
    t.ifError(err, 'no errors')
    t.equal(res.statusCode, 200)
    t.equal(res.result.branding.title, payload.branding.title)
    db.close()
    t.end()
  })
}))
