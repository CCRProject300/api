const test = require('tape')
const request = require('request')
const Async = require('async')
const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const authUser = require('./helpers/auth-user')
const addUser = require('./helpers/add-user')
const addLeague = require('./helpers/add-league')
const addCompany = require('./helpers/add-company')
const fakePublicLeague = require('./helpers/fake-public-league')

var serverUrl = null
var db = null

test('Start server', (t) => {
  t.plan(1)
  Server.start((err, ctx) => {
    t.ifError(err, 'Server started successfully')
    serverUrl = ctx.server.info.uri
    db = ctx.db
    t.end()
  })
})

test('Should be able to join individual league in the same company', (t) => {
  t.plan(3)

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

    function createCompany ({ users, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, league }))
    },

    function getToken ({ users, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, league, jwt }))
    },

    function joinLeague ({ users, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getLeague ({ res, users, league }, cb) {
      t.equal(res.statusCode, 200, 'Response should be 200')
      db.leagues.findOne({ _id: league._id, 'members.user': users[1]._id }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'User should be a member of league')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to join group league in the same company', (t) => {
  t.plan(3)

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

    function createCompany ({ users, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, league }))
    },

    function getToken ({ users, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, league, jwt }))
    },

    function joinLeague ({ users, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`,
        json: { panelId: league.panel[0].panelId.toString() }
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getLeague ({ res, users, league }, cb) {
      t.equal(res.statusCode, 200, 'Response should be 200')
      db.leagues.findOne({ _id: league._id, 'members.user': users[1]._id }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'User should be a member of league')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to join group league in the same company without supplying a valid panelId', (t) => {
  t.plan(3)

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

    function createCompany ({ users, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, league }))
    },

    function getToken ({ users, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, league, jwt }))
    },

    function joinLeague ({ users, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`,
        json: { panelId: ObjectId().toString() }
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getLeague ({ res, users, league }, cb) {
      t.equal(res.statusCode, 404, 'Response should be 404')
      db.leagues.findOne({ _id: league._id, 'members.user': users[1]._id }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(!count, 'User should not be a member of league')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to join individual league if user is already a member', (t) => {
  t.plan(3)

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
      addLeague(db, { members: users }, (err, league) => cb(err, { users, league }))
    },

    function createCompany ({ users, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, league }))
    },

    function getToken ({ users, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, league, jwt }))
    },

    function joinLeague ({ users, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getLeague ({ res, users, league }, cb) {
      t.equal(res.statusCode, 409, 'Response should be 409')
      db.leagues.findOne({ _id: league._id, 'members.user': users[1]._id }, cb)
    },

    function checkRedeemedNotification (count, cb) {
      t.ok(count, 'User should still be a member of league')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to join existing team in the same league', (t) => {
  t.plan(7)

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

    function createTeams (users, cb) {
      Async.map(users.slice(1), (user, done) => {
        const member = {
          user: user._id,
          startDate: Faker.date.recent(),
          active: true,
          activated: true
        }
        db.teams.insert({
          name: Faker.company.companyName(),
          deleted: false,
          members: [member]
        }, done)
      }, (err, teams) => cb(err, { users, teams }))
    },

    function createPanels ({ users, teams }, cb) {
      Async.map(teams, (team, done) => {
        db.panels.insert({
          name: Faker.commerce.color(),
          deleted: false,
          members: team.members,
          team: [{ teamId: team._id }]
        }, done)
      }, (err, panels) => cb(err, { users, teams, panels }))
    },

    function createLeague ({ users, teams, panels }, cb) {
      addLeague(db, {
        members: users,
        teamSize: 5,
        panel: panels.map((p) => ({ panelId: p._id }))
      }, (err, league) => cb(err, { users, teams, league }))
    },

    function createCompany ({ users, teams, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, teams, league }))
    },

    function getToken ({ users, teams, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, teams, league, jwt }))
    },

    function joinTeam ({ users, teams, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/switch`,
        json: { teamId: teams[1]._id.toString() }
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getPanelsAndTeams ({ res, users, league }, cb) {
      t.equal(res.statusCode, 200, 'Response should be 200')
      Async.parallel({
        panels: (done) => db.panels.find({}, done),
        teams: (done) => db.teams.find({}, done)
      }, (err, data) => cb(err, Object.assign({ users }, data)))
    },

    function checkPanelsAndTeams ({ users, panels, teams }, cb) {
      t.equal(teams.length, 1, 'There is only one remaining team')
      t.equal(teams[0].members.length, 2, 'The remaining team has two members')
      t.equal(panels.length, 2, 'There are still two panels')
      const panelSizes = panels.map((p) => p.members.length).sort((a, b) => a - b)
      t.equal(panelSizes[0], 0, 'One panel no longer has any members')
      t.equal(panelSizes[1], 2, 'One panel has two members')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to join new team in the same league', (t) => {
  t.plan(8)
  let destroyedTeamId

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

    function createTeams (users, cb) {
      Async.map(users.slice(1), (user, done) => {
        const member = {
          user: user._id,
          startDate: Faker.date.recent(),
          active: true,
          activated: true
        }
        db.teams.insert({
          name: Faker.company.companyName(),
          deleted: false,
          members: [member]
        }, done)
      }, (err, teams) => cb(err, { users, teams }))
    },

    function createPanels ({ users, teams }, cb) {
      destroyedTeamId = teams[0]._id

      Async.map(teams, (team, done) => {
        db.panels.insert({
          name: Faker.commerce.color(),
          deleted: false,
          members: team.members,
          team: [{ teamId: team._id }]
        }, done)
      }, (err, panels) => cb(err, { users, teams, panels }))
    },

    function createLeague ({ users, teams, panels }, cb) {
      addLeague(db, {
        members: users,
        teamSize: 5,
        panel: panels.map((p) => ({ panelId: p._id }))
      }, (err, league) => cb(err, { users, teams, panels, league }))
    },

    function createCompany ({ users, teams, panels, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, teams, panels, league }))
    },

    function getToken ({ users, teams, panels, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, teams, panels, league, jwt }))
    },

    function joinNewTeam ({ users, teams, panels, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/switch`,
        json: { panelId: panels[1]._id.toString() }
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getPanelsAndTeams ({ res, users, league }, cb) {
      t.equal(res.statusCode, 200, 'Response should be 200')
      Async.parallel({
        panels: (done) => db.panels.find({}, done),
        teams: (done) => db.teams.find({}, done)
      }, (err, data) => cb(err, Object.assign({ users }, data)))
    },

    function checkPanelsAndTeams ({ users, panels, teams }, cb) {
      t.equal(teams.length, 2, 'There is still two teams')
      t.ok(teams.every((t) => t.members.length === 1), 'Both teams have one member')
      t.ok(teams.every((t) => !t._id.equals(destroyedTeamId)), 'The team which was left no longer exists')
      t.equal(panels.length, 2, 'There are still two panels')
      const panelSizes = panels.map((p) => p.members.length).sort((a, b) => a - b)
      t.equal(panelSizes[0], 0, 'One panel no longer has any members')
      t.equal(panelSizes[1], 2, 'One panel has two members')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to join new team if not in the league already', (t) => {
  t.plan(6)

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

    function createTeams (users, cb) {
      Async.map(users.slice(2), (user, done) => {
        const member = {
          user: user._id,
          startDate: Faker.date.recent(),
          active: true,
          activated: true
        }
        db.teams.insert({
          name: Faker.company.companyName(),
          deleted: false,
          members: [member]
        }, done)
      }, (err, teams) => cb(err, { users, teams }))
    },

    function createPanels ({ users, teams }, cb) {
      Async.map(teams, (team, done) => {
        db.panels.insert({
          name: Faker.commerce.color(),
          deleted: false,
          members: team.members,
          team: [{ teamId: team._id }]
        }, done)
      }, (err, panels) => cb(err, { users, teams, panels }))
    },

    function createLeague ({ users, teams, panels }, cb) {
      addLeague(db, {
        members: users,
        teamSize: 5,
        panel: panels.map((p) => ({ panelId: p._id }))
      }, (err, league) => cb(err, { users, teams, panels, league }))
    },

    function createCompany ({ users, teams, panels, league }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, teams, panels, league }))
    },

    function getToken ({ users, teams, panels, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, teams, panels, league, jwt }))
    },

    function joinNewTeam ({ users, teams, panels, league, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/switch`,
        json: { panelId: panels[0]._id.toString() }
      }, (err, res) => cb(err, { res, users, league }))
    },

    function getPanelsAndTeams ({ res, users, league }, cb) {
      t.equal(res.statusCode, 404, 'Response should be 404')
      Async.parallel({
        panels: (done) => db.panels.find({}, done),
        teams: (done) => db.teams.find({}, done)
      }, (err, data) => cb(err, Object.assign({ users }, data)))
    },

    function checkPanelsAndTeams ({ users, panels, teams }, cb) {
      t.equal(teams.length, 1, 'There is still only one teams')
      t.equal(teams[0].members.length, 1, 'Team has one member')
      t.equal(panels.length, 1, 'There is still one panel')
      t.equal(panels[0].members.length, 1, 'Panel still has one member')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should not be able to join existing team in a different league', (t) => {
  t.plan(8)

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

    function createTeams (users, cb) {
      Async.map(users.slice(1), (user, done) => {
        const member = {
          user: user._id,
          startDate: Faker.date.recent(),
          active: true,
          activated: true
        }
        db.teams.insert({
          name: Faker.company.companyName(),
          deleted: false,
          members: [member]
        }, done)
      }, (err, teams) => cb(err, { users, teams }))
    },

    function createPanels ({ users, teams }, cb) {
      Async.map(teams, (team, done) => {
        db.panels.insert({
          name: Faker.commerce.color(),
          deleted: false,
          members: team.members,
          team: [{ teamId: team._id }]
        }, done)
      }, (err, panels) => cb(err, { users, teams, panels }))
    },

    function createLeagues ({ users, teams, panels }, cb) {
      Async.map(panels.map((panel, ind) => ({ panel, ind })), (panelObj, done) => {
        addLeague(db, {
          members: [users[panelObj.ind]],
          teamSize: 5,
          panel: [{ panelId: panelObj.panel._id }]
        }, done)
      }, (err, leagues) => cb(err, { users, teams, leagues }))
    },

    function createCompany ({ users, teams, leagues }, cb) {
      addCompany(db, { users, leagues: leagues.map((l) => ({ leagueId: l._id })) }, (err) => cb(err, { users, teams, leagues }))
    },

    function getToken ({ users, teams, leagues }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, teams, leagues, jwt }))
    },

    function joinTeam ({ users, teams, leagues, jwt }, cb) {
      request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${leagues[0]._id.toString()}/switch`,
        json: { teamId: teams[1]._id.toString() }
      }, (err, res) => cb(err, { res, users }))
    },

    function getLeaguesAndPanelsAndTeams ({ res, users }, cb) {
      t.equal(res.statusCode, 404, 'Response should be 404')
      Async.parallel({
        panels: (done) => db.panels.find({}, done),
        leagues: (done) => db.leagues.find({}, done),
        teams: (done) => db.teams.find({}, done)
      }, (err, data) => cb(err, Object.assign({ users }, data)))
    },

    function checkPanelsAndTeams ({ users, panels, leagues, teams }, cb) {
      t.equal(teams.length, 2, 'There are still two teams')
      t.equal(panels.length, 2, 'There are still two panels')
      t.equal(leagues.length, 2, 'There are still two leagues')
      t.ok(teams.every((t) => t.members.length === 1), 'Both teams have one member')
      t.ok(panels.every((p) => p.members.length === 1), 'Both panels have one member')
      t.ok(leagues.every((l) => l.members.length === 1), 'Both leagues have one member')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should be able to get a public league without auth', (t) => {
  t.plan(3)

  const fakeLeague = Object.assign({
    deleted: false,
    leagueType: 'public'
  }, fakePublicLeague())

  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => db.leagues.insert(fakeLeague, cb),
    (league, cb) => {
      request.get({
        url: `${serverUrl}/league/${league._id}/public`,
        json: true
      }, cb)
    }
  ], (err, res, body) => {
    t.ifError(err, 'No error')
    t.equal(res.statusCode, 200, '200 ok')
    const { _id, name, startDate, endDate, description, branding } = fakeLeague
    t.same(body, { _id: _id.toString(), name, startDate, endDate, description, branding })
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
