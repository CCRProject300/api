const test = require('tape')
const Request = require('request')
const Async = require('async')
const Faker = require('faker')
const Server = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const authUser = require('./helpers/auth-user')
const addCompany = require('./helpers/add-company')
const fakePublicLeague = require('./helpers/fake-public-league')
// const sinon = require('sinon')

let serverUrl = null
let db = null

const mailer = {send: (tpl, email, data, cb) => cb()}
// const mailerSpy = sinon.spy(mailer, 'send')

const companyName = Faker.company.companyName()

const fakeUser = (opts) => {
  return Object.assign({
    email: Faker.internet.email(),
    auth0Id: Faker.internet.password(),
    companyName
  }, opts || {})
}

test('Start server', (t) => {
  t.plan(1)
  Server.start({ mailer }, (err, ctx) => {
    t.ifError(err, 'Server started successfully')
    serverUrl = ctx.server.info.uri
    db = ctx.db
    t.end()
  })
})

test('Should be able to join a public league as an individual', (t) => {
  t.plan(2)

  const fakeLeague = fakePublicLeague({
    teamSize: 1
  })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(2).fill(0).map(() => ({ email: Faker.internet.email(), auth0Id: Faker.internet.password() }))
      Async.map(users, addUser.bind(null, db), cb)
    },
    function createLeague (users, cb) {
      db.leagues.insert(fakeLeague, (err, league) => {
        cb(err, { users, league })
      })
    },
    function createCompany ({ league, users }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, league }))
    },
    function getToken ({ users, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, league, jwt }))
    },
    function joinLeague ({ users, league, jwt }, cb) {
      Request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`
      }, (err, res) => cb(err, { res, users, league }))
    },
    function getLeague ({ res, users, league }, cb) {
      t.equal(res.statusCode, 200, 'Response should be 200')
      db.leagues.findOne({ _id: league._id, 'members.user': users[1]._id }, cb)
    }
  ], (err) => {
    t.ifError(err, 'No error')
    t.end()
  })
})

test('Should NOT be able to join a public league if you are a member already', (t) => {
  t.plan(4)

  const fakeLeague = fakePublicLeague({
    teamSize: 1
  })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(2).fill(0).map(() => ({ email: Faker.internet.email(), auth0Id: Faker.internet.password() }))
      Async.map(users, addUser.bind(null, db), cb)
    },
    function createLeague (users, cb) {
      db.leagues.insert(fakeLeague, (err, league) => {
        cb(err, { users, league })
      })
    },
    function createCompany ({ league, users }, cb) {
      addCompany(db, { users, leagues: { leagueId: league._id } }, (err) => cb(err, { users, league }))
    },
    function getToken ({ users, league }, cb) {
      authUser(db, users[1], (err, jwt) => cb(err, { users, league, jwt }))
    },
    function joinLeague ({ users, league, jwt }, cb) {
      Request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`
      }, (err, res) => cb(err, { res, users, league, jwt }))
    },
    function joinLeague ({ res, users, league, jwt }, cb) {
      t.equal(res.statusCode, 200)
      Request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`
      }, (err, res) => cb(err, { res, users, league }))
    },
    function getLeague ({ res, users, league }, cb) {
      t.equal(res.statusCode, 409, 'Response should be 409')
      db.leagues.findOne({ _id: league._id }, cb)
    }
  ], (err, league) => {
    t.ifError(err, 'No error')
    t.equal(league.members.length, 1, 'remains with one member')
    t.end()
  })
})

test('Should add a user to a company team where one does not exist', (t) => {
  t.plan(5)

  const fakeLeague = fakePublicLeague({
    teamSize: 3
  })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUser (cb) {
      addUser(db, fakeUser(), cb)
    },
    function createLeagueDataObjects (user, cb) {
      db.leagues.insert(fakeLeague, (err, league) => {
        cb(err, { user, league })
      })
    },
    function createCompany ({ user, league }, cb) {
      const name = user.companyName
      const leagues = { leagueId: league._id }
      addCompany(db, { users: [user], name, leagues }, (err) => cb(err, { user, league }))
    },
    function getToken ({ user, league }, cb) {
      authUser(db, user, (err, jwt) => cb(err, { user, league, jwt }))
    },
    function joinLeague ({ user, league, jwt }, cb) {
      Request.post({
        headers: { authorization: jwt },
        url: `${serverUrl}/league/${league._id.toString()}/join`
      }, (err) => cb(err, { user, league }))
    },
    function getUpdates ({ user, league }, cb) {
      Async.parallel({
        league: (done) => db.leagues.findOne({ _id: league._id }, done),
        teams: (done) => db.teams.findOne({}, done),
        panel: (done) => db.panels.findOne({}, done)
      }, cb)
    }
  ], (err, results) => {
    t.ifError(err, 'No error')
    const { league, teams, panel } = results
    t.equal(league.panel.length, 1, 'company panel created')
    t.equal(panel.name, companyName, 'panel named after company')
    t.equal(teams.members.length, 1, 'member added to team')
    t.equal(teams.name, `Team 1 - ${companyName}`, `first team is named: Team 1 - ${companyName}`)
    t.end()
  })
})

test('Should place members into teams of a size', (t) => {
  t.plan(4)

  const fakeLeague = fakePublicLeague({
    teamSize: 2
  })

  Async.waterfall([
    (cb) => clearDb(db, cb),
    function createUsers (cb) {
      const users = Array(3).fill(0).map(() => fakeUser())
      Async.map(users, addUser.bind(null, db), cb)
    },
    function createLeague (users, cb) {
      db.leagues.insert(fakeLeague, (err, league) => cb(err, { users, league }))
    },
    function createCompany ({ users, league }, cb) {
      const leagues = { leagueId: league._id }
      addCompany(db, { users, name: companyName, leagues }, (err) => cb(err, { users, league }))
    },
    function joinLeague ({ users, league }, cb) {
      Async.eachSeries(users, (user, done) => {
        authUser(db, user, (err, jwt) => {
          if (err) return cb(err)
          Request.post({
            headers: { authorization: jwt },
            url: `${serverUrl}/league/${league._id.toString()}/join`
          }, done)
        })
      }, cb)
    },
    function getTeams (cb) {
      Async.parallel({
        league: (done) => db.leagues.find({}, done),
        panel: (done) => db.panels.find({}, done),
        teams: (done) => db.teams.find({}, done)
      }, cb)
    }
  ], (err, results) => {
    const { league, panel, teams } = results
    t.ifError(err, 'No error')
    t.equal(league[0].panel.length, 1, 'there is one panel in the league')
    t.equal(panel.length, 1, 'there is 1 panel')
    t.equal(teams.length, 2, 'with 2 teams')
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
