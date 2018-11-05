const test = require('tape')
const Async = require('async')
const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const { getToken } = require('./helpers/auth-user')
const addUser = require('./helpers/add-user')
const addLeague = require('./helpers/add-league')
const addCompany = require('./helpers/add-company')

test('Should create new user notifications on sign up and be able to accept one', withServer((t, { server, db }) => {
  t.plan(5)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function addUser (cb) {
      const user = { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
      const token = getToken(user)

      server.inject({
        method: 'POST',
        url: '/user',
        payload: {
          firstName: Faker.name.firstName(),
          lastName: Faker.name.lastName(),
          email: user.email
        },
        headers: {
          authorization: token
        }
      }, (res) => cb(null, res, res.result, token))
    },
    function getCreatedNotifications (res, user, token, cb) {
      const userId = ObjectId(user._id)
      db.notifications.find({ 'user._id': userId }, (err, notifications) => {
        if (err) return cb(err)
        cb(null, userId, token, notifications)
      })
    },
    function checkCreatedNotificationsAndRedeem (userId, token, notifications, cb) {
      const onboardingNotification = notifications.find((n) => n.type === 'onboarding')
      t.ok(onboardingNotification, 'Onboarding notification exists')
      t.ok(notifications.find((n) => n.type === 'missingStats'), 'Missing stats notification exists')
      if (!onboardingNotification) return cb(null, {}, {})
      server.inject({
        method: 'POST',
        headers: { authorization: token },
        url: `/notifications/${onboardingNotification._id.toString()}/confirm`
      }, (res) => cb(null, userId, res))
    },
    function getRedeemedNotification (userId, res, cb) {
      t.equals(res.statusCode, 200, 'Confirmation response code shoud be 200')
      db.notifications.count({ 'user._id': userId, type: 'onboarding', redeemedAt: { $ne: null } }, cb)
    },
    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'Notification should have been redeemed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should create join individual league notification and be able to accept one', withServer((t, { server, db }) => {
  t.plan(5)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(2).fill(0).map((_, ind) => {
        const user = { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
        if (!ind) user.roles = ['admin']
        return user
      })
      Async.map(users, addUser.bind(null, db), cb)
    },

    function createLeague (users, cb) {
      addLeague(db, { members: users.slice(0, 1) }, (err, league) => cb(err, { users, league }))
    },

    function inviteUser ({ users, league }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[0]) },
        url: `/league/${league._id.toString()}/members/invite`,
        payload: { users: [users[1]._id.toString()] }
      }, (res) => {
        t.equal(res.statusCode, 200, 'User should be invited to league')
        cb(null, { users, league })
      })
    },

    function getCreatedNotification ({ users, league }, cb) {
      const userId = users[1]._id
      db.notifications.findOne({ 'user._id': userId, type: 'indLeagueInvite' }, (err, notification) => {
        t.ok(notification, 'Notification has been created')
        cb(err, { users, league, notification })
      })
    },

    function respondToNotification ({ users, league, notification }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[1]) },
        url: `/notifications/${notification._id.toString()}/confirm`
      }, (res) => cb(null, { users, res }))
    },

    function getRedeemedNotification ({ users, res }, cb) {
      t.equals(res.statusCode, 200, 'Confirmation response code shoud be 200')
      db.notifications.count({ 'user._id': users[1]._id, type: 'indLeagueInvite', redeemedAt: { $ne: null } }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'Notification should have been redeemed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should create join group league notification and be able to accept one', withServer((t, { server, db }) => {
  t.plan(5)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(2).fill(0).map((_, ind) => {
        const user = { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
        if (!ind) user.roles = ['admin']
        return user
      })
      Async.map(users, addUser.bind(null, db), cb)
    },

    function createPanel (users, cb) {
      db.panels.insert({
        name: Faker.commerce.color(),
        deleted: false
      }, (err, panel) => cb(err, { users, panel }))
    },

    function createLeague ({ users, panel }, cb) {
      addLeague(db, {
        members: users.slice(0, 1),
        teamSize: 5,
        panel: [{ panelId: panel._id }]
      }, (err, league) => cb(err, { users, league }))
    },

    function inviteUser ({ users, league }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[0]) },
        url: `/league/${league._id.toString()}/members/invite`,
        payload: { users: [users[1]._id.toString()] }
      }, (res) => {
        t.equal(res.statusCode, 200, 'User should be invited to league')
        cb(null, { users, league })
      })
    },

    function getCreatedNotification ({ users, league }, cb) {
      const userId = users[1]._id
      db.notifications.findOne({ 'user._id': userId, type: 'groupLeagueInvite' }, (err, notification) => {
        t.ok(notification, 'Notification has been created')
        cb(err, { users, league, notification })
      })
    },

    function respondToNotification ({ users, league, notification }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[1]) },
        url: `/notifications/${notification._id.toString()}/confirm`,
        payload: { data: { panelId: notification.panels[0]._id.toString() } }
      }, (res) => cb(null, { users, res }))
    },

    function getRedeemedNotification ({ users, res }, cb) {
      t.equals(res.statusCode, 200, 'Confirmation response code shoud be 200')
      db.notifications.count({ 'user._id': users[1]._id, type: 'groupLeagueInvite', redeemedAt: { $ne: null } }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'Notification should have been redeemed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to accept a group league notification without supplying valid panelId', withServer((t, { server, db }) => {
  t.plan(5)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(2).fill(0).map((_, ind) => {
        const user = { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
        if (!ind) user.roles = ['admin']
        return user
      })
      Async.map(users, addUser.bind(null, db), cb)
    },

    function createPanel (users, cb) {
      db.panels.insert({
        name: Faker.commerce.color(),
        deleted: false
      }, (err, panel) => cb(err, { users, panel }))
    },

    function createLeague ({ users, panel }, cb) {
      addLeague(db, {
        members: users.slice(0, 1),
        teamSize: 5,
        panel: [{ panelId: panel._id }]
      }, (err, league) => cb(err, { users, league }))
    },

    function inviteUser ({ users, league }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[0]) },
        url: `/league/${league._id.toString()}/members/invite`,
        payload: { users: [users[1]._id.toString()] }
      }, (res) => {
        t.equal(res.statusCode, 200, 'User should be invited to league')
        cb(null, { users, league })
      })
    },

    function getCreatedNotification ({ users, league }, cb) {
      const userId = users[1]._id
      db.notifications.findOne({ 'user._id': userId, type: 'groupLeagueInvite' }, (err, notification) => {
        t.ok(notification, 'Notification has been created')
        cb(err, { users, league, notification })
      })
    },

    function respondToNotification ({ users, league, notification }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[1]) },
        url: `/notifications/${notification._id.toString()}/confirm`,
        payload: { data: { panelId: ObjectId().toString() } }
      }, (res) => cb(null, { users, res }))
    },

    function getRedeemedNotification ({ users, res }, cb) {
      t.equals(res.statusCode, 404, 'Confirmation response code shoud be 404')
      db.notifications.count({ 'user._id': users[1]._id, type: 'groupLeagueInvite', redeemedAt: null }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'Notification should not have been redeemed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should not be able to accept another user\'s join league notification', withServer((t, { server, db }) => {
  t.plan(5)

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(3).fill(0).map((_, ind) => {
        const user = { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
        if (!ind) user.roles = ['admin']
        return user
      })
      Async.map(users, addUser.bind(null, db), cb)
    },

    function createLeague (users, cb) {
      addLeague(db, { members: users.slice(0, 1) }, (err, league) => cb(err, { users, league }))
    },

    function inviteUser ({ users, league }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[0]) },
        url: `/league/${league._id.toString()}/members/invite`,
        payload: { users: [users[1]._id.toString()] }
      }, (res) => {
        t.equal(res.statusCode, 200, 'User should be invited to league')
        cb(null, { users, league })
      })
    },

    function getCreatedNotification ({ users, league }, cb) {
      const userId = users[1]._id
      db.notifications.findOne({ 'user._id': userId, type: 'indLeagueInvite' }, (err, notification) => {
        t.ok(notification, 'Notification has been created')
        cb(err, { users, league, notification })
      })
    },

    function respondToNotification ({ users, league, notification, jwt }, cb) {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[2]) },
        url: `/notifications/${notification._id.toString()}/confirm`
      }, (res) => cb(null, { users, res }))
    },

    function getRedeemedNotification ({ users, res }, cb) {
      t.equals(res.statusCode, 403, 'Confirmation should be forbidden')
      db.notifications.count({ 'user._id': users[1]._id, type: 'indLeagueInvite', redeemedAt: null }, cb)
    },

    function checkNotification (count, cb) {
      t.ok(count, 'Notification should not have been redeemed')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should join a company and inherit roles', withServer((t, { server, db }) => {
  t.plan(5)

  const COMPANY_ROLES = ['foo', 'bar']

  Async.auto({
    clearDb: (cb) => clearDb(db, cb),

    users: ['clearDb', (_, cb) => {
      const users = Array(2).fill(0).map(() => (
        { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
      ))
      Async.map(users, addUser.bind(null, db), cb)
    }],

    company: ['users', ({ users }, cb) => {
      addCompany(db, { users: [users[0]], roles: COMPANY_ROLES }, cb)
    }],

    inviteUser1: ['users', 'company', ({ users, company }, cb) => {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[0]) },
        url: `/company/${company._id}/members`,
        payload: [users[1]._id.toString()]
      }, (res) => {
        t.equal(res.statusCode, 200, 'User should be invited to the company')
        cb(null, res)
      })
    }],

    notification: ['users', 'inviteUser1', ({ users }, cb) => {
      const query = { 'user._id': users[1]._id, type: 'companyInvite' }
      db.notifications.findOne(query, (err, notification) => {
        t.ok(notification, 'Notification has been created')
        cb(err, notification)
      })
    }],

    confirmNotification: ['users', 'notification', ({ users, notification }, cb) => {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[1]) },
        url: `/notifications/${notification._id}/confirm`
      }, (res) => {
        t.equals(res.statusCode, 200, 'Confirmation response code should be 200')
        cb(null, res)
      })
    }],

    updatedUser: ['confirmNotification', ({ users }, cb) => {
      db.users.findOne({ _id: users[1]._id }, cb)
    }],

    checkInheritedRoles: ['updatedUser', ({ updatedUser }, cb) => {
      t.ok(
        COMPANY_ROLES.every((role) => updatedUser.roles.includes(role)),
        `Company roles ${COMPANY_ROLES} belong to user`
      )
      cb()
    }]
  }, (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))

test('Should join a company as corporate_mod and inherit roles', withServer((t, { server, db }) => {
  t.plan(5)

  const COMPANY_ROLES = ['foo', 'bar']

  Async.auto({
    clearDb: (cb) => clearDb(db, cb),

    users: ['clearDb', (_, cb) => {
      const users = Array(2).fill(0).map(() => (
        { email: Faker.internet.email(), auth0Id: Faker.internet.password() }
      ))
      users[0].roles = ['admin']
      Async.map(users, addUser.bind(null, db), cb)
    }],

    company: ['users', ({ users }, cb) => {
      addCompany(db, { users: [], roles: COMPANY_ROLES }, cb)
    }],

    inviteUser1: ['users', 'company', ({ users, company }, cb) => {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[0]) },
        url: `/admin/company/${company._id}/moderators`,
        payload: [users[1]._id.toString()]
      }, (res) => {
        t.equal(res.statusCode, 200, 'User should be invited to the company')
        cb(null, res)
      })
    }],

    notification: ['users', 'inviteUser1', ({ users }, cb) => {
      const query = { 'user._id': users[1]._id, type: 'corpModInvite' }
      db.notifications.findOne(query, (err, notification) => {
        t.ok(notification, 'Notification has been created')
        cb(err, notification)
      })
    }],

    confirmNotification: ['users', 'notification', ({ users, notification }, cb) => {
      server.inject({
        method: 'POST',
        headers: { authorization: getToken(users[1]) },
        url: `/notifications/${notification._id}/confirm`
      }, (res) => {
        t.equals(res.statusCode, 200, 'Confirmation response code should be 200')
        cb(null, res)
      })
    }],

    updatedUser: ['confirmNotification', ({ users }, cb) => {
      db.users.findOne({ _id: users[1]._id }, cb)
    }],

    checkInheritedRoles: ['updatedUser', ({ updatedUser }, cb) => {
      t.ok(
        COMPANY_ROLES.every((role) => updatedUser.roles.includes(role)),
        `Company roles ${COMPANY_ROLES} belong to user`
      )
      cb()
    }]
  }, (err) => {
    t.ifError(err, 'No error')
    db.close()
    t.end()
  })
}))
