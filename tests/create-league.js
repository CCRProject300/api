const test = require('tape')
const Moment = require('moment')
const Request = require('request')
const Async = require('async')
const ObjectId = require('mongojs').ObjectId
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const authUser = require('./helpers/auth-user')
const sinon = require('sinon')

let mailer = {}
let serverUrl = null
let db = null

test('Start server', (t) => {
  t.plan(1)
  Server.start({mailer}, (err, ctx) => {
    t.ifError(err, 'Server started successfully')
    serverUrl = ctx.server.info.uri
    db = ctx.db
    t.end()
  })
})

test('Should be able to create a league and add users', (t) => {
  // create 4 users and add them to a company
  // - user[0] is the company mod
  // - user[1] and user[2] are added to the league on creation
  // - user[3] is added to the league afterwards.
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db)
    ], cb),
    (users, cb) => addCompany(db, {users}, (err, company) => {
      cb(err, users, company)
    }),
    function login (users, company, cb) {
      const moderator = users[0]
      authUser(serverUrl, moderator.authData, (err, token) => cb(err, users, company, { token, moderator }))
    },
    function createLeague (users, company, { token, moderator }, cb) {
      // stub out the send function so we can assert it is called
      // `mailer.send('email tpl name', 'to address', {data}, cb)`
      mailer.send = sinon.stub()
      // Get the stub to call the callback to keep things moving.
      mailer.send.callsArgAsync(3)

      Request.post({
        url: `${serverUrl}/company/${company._id}/league`,
        headers: { authorization: token },
        json: {
          name: 'test league',
          description: 'just a test',
          startDate: Moment().add(1, 'days').toISOString(),
          endDate: Moment().add(10, 'days').toISOString(),
          teamSize: 1,
          users: [users[1]._id, users[2]._id]
        }
      }, (err, res, body) => {
        t.ok(mailer.send.calledTwice, '2 emails sent')
        t.ok(mailer.send.firstCall.calledWith('user-added-to-league', users[1].emails[0].address), 'Email sent to ' + users[1].emails[0].address)
        t.ok(mailer.send.secondCall.calledWith('user-added-to-league', users[2].emails[0].address), 'Email sent to ' + users[2].emails[0].address)
        t.equal(res.statusCode, 201, 'Status code is 201 Created')
        t.equal(body.name, 'test league', 'name is correct')
        t.equal(body.memberCount, 2, 'memberCount is correct')
        cb(err, users, company, { token, moderator }, body)
      })
    },
    function addMemberToLeague (users, company, { token, moderator }, league, cb) {
      // stub out the send function so we can assert it is called
      // `mailer.send('email tpl name', 'to address', {data}, cb)`
      mailer.send = sinon.stub()
      // Get the stub to call the callback to keep things moving.
      mailer.send.callsArgAsync(3)

      Request.post({
        url: `${serverUrl}/league/${league._id}/members/invite`,
        headers: { authorization: token },
        json: { users: [users[3]._id] }
      }, (err, res, body) => {
        t.ok(mailer.send.calledOnce, '1 email sent')
        t.ok(mailer.send.firstCall.calledWith('user-added-to-league', users[3].emails[0].address), 'Email sent to ' + users[3].emails[0].address)
        t.equal(res.statusCode, 200, 'Status code is 201 Created')
        cb(err)
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to create a group league with limited team size and add users', (t) => {
  // create 6 users and add them to a company
  // - users[0] is the company mod
  // - users[1-6] are added to the league afterwards.
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db)
    ], cb),
    (users, cb) => addCompany(db, {users}, (err, company) => {
      cb(err, users, company)
    }),
    function login (users, company, cb) {
      const moderator = users[0]
      authUser(serverUrl, moderator.authData, (err, token) => cb(err, users, company, { token, moderator }))
    },
    function createLeague (users, company, { token, moderator }, cb) {
      // stub out the send function so we can assert it is called
      // `mailer.send('email tpl name', 'to address', {data}, cb)`
      mailer.send = sinon.stub()
      // Get the stub to call the callback to keep things moving.
      mailer.send.callsArgAsync(3)

      Request.post({
        url: `${serverUrl}/company/${company._id}/league`,
        headers: { authorization: token },
        json: {
          name: 'group league',
          description: 'just a test',
          startDate: Moment().add(1, 'days').toISOString(),
          endDate: Moment().add(10, 'days').toISOString(),
          teamSize: 2,
          minTeamSize: 1,
          categories: ['panel'],
          users: []
        }
      }, (err, res, body) => {
        t.equal(res.statusCode, 201, 'Status code is 201 Created')
        t.equal(body.name, 'group league', 'name is correct')
        t.equal(body.memberCount, 0, 'memberCount is correct')
        cb(err, users, company, { token, moderator }, body)
      })
    },
    function addMemberToLeague (users, company, { token, moderator }, league, cb) {
      // stub out the send function so we can assert it is called
      // `mailer.send('email tpl name', 'to address', {data}, cb)`
      mailer.send = sinon.stub()
      // Get the stub to call the callback to keep things moving.
      mailer.send.callsArgAsync(3)

      Async.each(users.slice(1), (user, done) => {
        Request.post({
          url: `${serverUrl}/league/${league._id}/members/invite`,
          headers: { authorization: token },
          json: { users: [user._id] }
        }, done)
      }, (err) => {
        cb(err, users)
      })
    },
    function getNotifications (users, cb) {
      db.notifications.find({}, (err, notifications) => {
        cb(err, users, notifications)
      })
    },
    function authenticateUsers (users, notifications, cb) {
      Async.map(users.slice(1), (user, done) => {
        authUser(db, user, (err, token) => done(err, { token, user }))
      }, (err, tokenDocs) => {
        cb(err, tokenDocs, notifications)
      })
    },
    function redeemNotifications (tokenDocs, notifications, cb) {
      Async.eachSeries(tokenDocs, ({ token, user }, done) => {
        const notification = notifications.find((n) => n.user._id.equals(user._id))
        Request.post({
          headers: { authorization: token },
          url: `${serverUrl}/notifications/${notification._id.toString()}/confirm`,
          json: { data: { panelId: notification.panels[0]._id.toString() } }
        }, (err, res, body) => {
          if (err) return done(err)
          t.equal(res.statusCode, 200, 'Status code is 200')
          done()
        })
      }, cb)
    },
    function checkTeamsHaveBeenCreated (cb) {
      db.teams.count({}, (err, count) => {
        if (err) return cb(err)
        t.equal(count, 3, 'Three teams have been created')
        cb()
      })
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to add members directly to an individual league', (t) => {
  t.plan(4)
  // create 3 users and add them to a company
  // - user[0] is the company mod
  // - user[1] and user[2] are added to the league without invite
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db)
    ], cb),
    (users, cb) => addCompany(db, {users}, (err, company) => {
      cb(err, users, company)
    }),
    function login (users, company, cb) {
      const moderator = users[0]
      authUser(serverUrl, moderator.authData, (err, token) => cb(err, users, company, { token, moderator }))
    },
    function createLeague (users, company, { token, moderator }, cb) {
      Request.post({
        url: `${serverUrl}/company/${company._id}/league`,
        headers: { authorization: token },
        json: {
          name: 'test league',
          description: 'just a test to add members without invite',
          startDate: Moment().add(1, 'days').toISOString(),
          endDate: Moment().add(10, 'days').toISOString(),
          teamSize: 1
        }
      }, (err, res, body) => cb(err, users, company, { token, moderator }, body))
    },
    function addMembersToLeagueDirectly (users, company, { token, moderator }, league, cb) {
      Request.post({
        url: `${serverUrl}/league/${league._id}/members`,
        headers: { authorization: token },
        json: { users: [users[1]._id, users[2]._id] }
      }, (err, res, body) => {
        t.equal(res.statusCode, 200)
        cb(err, league)
      })
    },
    function checkLeague (league, cb) {
      db.leagues.findOne({ _id: new ObjectId(league._id) }, cb)
    }
  ], (err, league) => {
    t.ifError(err, 'No error')
    t.equal(league.members.length, 2)
    t.ok(league.members.every((m) => m.activated))
    t.end()
  })
})

test('Should be able to add members directly to a group league', (t) => {
  t.plan(6)
  // create 3 users and add them to a company
  // - user[0] is the company mod
  // - user[1] and user[2] are added to the league without invite
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db),
      addUser.bind(addUser, db)
    ], cb),
    (users, cb) => addCompany(db, {users}, (err, company) => {
      cb(err, users, company)
    }),
    function login (users, company, cb) {
      const moderator = users[0]
      authUser(serverUrl, moderator.authData, (err, token) => cb(err, users, company, { token, moderator }))
    },
    function createLeague (users, company, { token, moderator }, cb) {
      Request.post({
        url: `${serverUrl}/company/${company._id}/league`,
        headers: { authorization: token },
        json: {
          name: 'test league',
          description: 'just a test to add members without invite',
          startDate: Moment().add(1, 'days').toISOString(),
          endDate: Moment().add(10, 'days').toISOString(),
          teamSize: 2,
          minTeamSize: 1,
          categories: ['One', 'Two']
        }
      }, (err, res, body) => cb(err, users, company, { token, moderator }, body))
    },
    function getLeague (users, company, { token, moderator }, league, cb) {
      // Returned league does not include panels field
      db.leagues.findOne({ _id: new ObjectId(league._id) }, (err, league) => {
        cb(err, users, company, { token, moderator }, league)
      })
    },
    function addMembersToLeagueDirectly (users, company, { token, moderator }, league, cb) {
      Request.post({
        url: `${serverUrl}/league/${league._id}/members`,
        headers: { authorization: token },
        json: { users: [users[1]._id, users[2]._id, users[3]._id, users[4]._id], panelId: league.panel[0].panelId }
      }, (err, res, body) => {
        t.equal(res.statusCode, 200)
        cb(err, league.panel[0], league)
      })
    },
    function getLeagueAgain ({ panelId }, league, cb) {
      // League will now have had members added to it
      db.leagues.findOne({ _id: league._id }, (err, league) => {
        cb(err, panelId, league)
      })
    },
    function getPanels (panelId, league, cb) {
      db.panels.findOne({ _id: panelId }, (err, panel) => {
        cb(err, panel, league)
      })
    },
    function getTeams (panel, league, cb) {
      db.teams.find({ _id: { $in: (panel.team.map((t) => t.teamId)) } }, (err, teams) => {
        cb(err, teams, league)
      })
    }
  ], (err, teams, league) => {
    t.ifError(err, 'No error')
    t.equal(league.members.length, 4)
    t.ok(league.members.every((m) => m.activated))
    t.equal(teams.length, 2)
    t.ok(teams.every((team) => team.members.length === 2))
    t.end()
  })
})

test('Should send added notification when members are directly added to a league', (t) => {
  t.plan(2)

  mailer.send = (tpl, email, data, cb) => cb()
  sinon.spy(mailer, 'send')

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db)
    ], cb),
    (users, cb) => addCompany(db, {users}, (err, company) => {
      cb(err, users, company)
    }),
    function login (users, company, cb) {
      const moderator = users[0]
      authUser(serverUrl, moderator.authData, (err, token) => cb(err, users, company, { token, moderator }))
    },
    function createLeague (users, company, { token, moderator }, cb) {
      Request.post({
        url: `${serverUrl}/company/${company._id}/league`,
        headers: { authorization: token },
        json: {
          name: 'test league',
          description: 'just a test to add members without invite',
          startDate: Moment().add(1, 'days').toISOString(),
          endDate: Moment().add(10, 'days').toISOString(),
          teamSize: 1
        }
      }, (err, res, body) => cb(err, users, company, { token, moderator }, body))
    },
    function addMembersToLeagueDirectly (users, company, { token, moderator }, league, cb) {
      Request.post({
        url: `${serverUrl}/league/${league._id}/members`,
        headers: { authorization: token },
        json: { users: [users[1]._id] }
      }, (err, res, body) => {
        cb(err, token, league, users)
      })
    },
    function checkLeague (token, league, users, cb) {
      Request.get({
        url: `${serverUrl}/league/${league._id}/leaderboard`,
        headers: { authorization: token }
      }, (err, res, body) => cb(err, users))
    }
  ], (err, users) => {
    t.ifError(err, 'No error')
    t.equal(mailer.send.getCall(0).args[0], 'user-joined-a-league')
    mailer.send.restore()
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
