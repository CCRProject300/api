const test = require('tape')
const config = require('config')
const async = require('async')
const db = require('mongojs')(config.mongo)
const ObjectId = require('mongojs').ObjectId
const clearDb = require('./helpers/clear-db')
const addLeague = require('./helpers/add-league')
const addUser = require('./helpers/add-user')
const faker = require('faker')
const fakeLeagueStanding = require('./helpers/fake-league-standings')
const tasks = require('../lib/cron-tasks')
const pugTpl = require('../emails/user-notify-leaderboard-update').body
const artifacts = require('./artifacts')

const mailer = {
  send: (tpl, email, data, cb) => {
    console.log('sending email to ', email)
    cb()
  }
}

test('Should email users in a league', (t) => {
  t.plan(3)

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map([{}, {}], (user, done) => addUser(db, user, done), cb),
    (members, cb) => addLeague(db, {members}, cb),
    (league, cb) => {
      async.map(league.members, (member, done) => {
        db.users.findOne({_id: member.user}, (err, user) => {
          if (err) return done(err)
          const dailyStat = fakeLeagueStanding({
            leagueName: league.name,
            leagueId: league._id,
            name: user.firstName + ' ' + user.lastName,
            userId: ObjectId(user._id),
            members: [ObjectId(user._id)]
          })
          db.dailyStats.insert(dailyStat, done)
        })
      }, cb)
    },
    (stats, cb) => {
      tasks.leaderboard({ db, mailer }, cb)
    },
    (report, cb) => {
      t.ok(report, 'The leaderboard cron job returns a report object')
      t.equal(report.success, 2, 'both users are emailed their leaderboard changes')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should email members of a team in a league', (t) => {
  t.plan(2)

  const team = [{}, {}, {emailPreferences: {leaderboard: false}}]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(team, (user, done) => addUser(db, user, done), cb),
    (members, cb) => addLeague(db, {members}, cb),
    (league, cb) => {
      const leagueStanding = fakeLeagueStanding({
        leagueName: league.name,
        leagueId: league._id,
        userId: ObjectId(),
        members: league.members.map((m) => m.user),
        rankingPosition: 1
      })
      db.dailyStats.insert(leagueStanding, (err) => cb(err))
    },
    (cb) => tasks.leaderboard({ db, mailer }, cb),
    (report, cb) => {
      t.equal(report.success, 2, 'two opt IN team members of 3 receive an email')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should be able to opt out of email notifications', (t) => {
  t.plan(2)

  const usersWithPreferences = [{
    emailPreferences: {
      leaderboard: false
    }
  }, {}]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map(usersWithPreferences, (user, done) => addUser(db, user, done), cb),
    (members, cb) => addLeague(db, {members}, cb),
    (league, cb) => {
      async.map(league.members, (member, done) => {
        db.users.findOne({_id: member.user}, (err, user) => {
          if (err) return done(err)

          const dailyStat = fakeLeagueStanding({
            leagueName: league.name,
            leagueId: league._id,
            name: user.firstName + ' ' + user.lastName,
            userId: user._id,
            members: [ObjectId(user._id)]
          })

          db.dailyStats.insert(dailyStat, done)
        })
      }, cb)
    },
    (stats, cb) => {
      tasks.leaderboard({ db, mailer }, cb)
    },
    (report, cb) => {
      t.equal(report.success, 1, 'Opt IN user is emailed their leaderboard changes')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should send no email notifications if there are no daily stats', (t) => {
  t.plan(1)

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map([{}, {}], (user, done) => addUser(db, user, done), cb),
    (members, cb) => addLeague(db, {members}, cb),
    (league, cb) => {
      async.map(league.members, (member, done) => {
        db.users.findOne({_id: member.user}, (err, user) => {
          if (err) return done(err)

          const dailyStat = fakeLeagueStanding({ date: faker.date.past() })

          db.dailyStats.insert(dailyStat, done)
        })
      }, cb)
    },
    (stats, cb) => tasks.leaderboard({ db, mailer }, cb)
  ], (err, report) => {
    t.equal(err.message, 'no dailyStats results', 'If no dailyStats are found cron-task returns an error')
    t.end()
  })
})

test('Should only send emails to users who\'s position has changed', (t) => {
  t.plan(2)

  const positions = [1, -1, 0, 0, 0]

  async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => async.map([{}, {}, {}, {}, {}], (user, done) => addUser(db, user, done), cb),
    (members, cb) => addLeague(db, {members}, cb),
    (league, cb) => {
      async.map(league.members, (member, done) => {
        db.users.findOne({_id: member.user}, (err, user) => {
          if (err) return done(err)

          const dailyStat = fakeLeagueStanding({
            leagueName: league.name,
            leagueId: league._id,
            name: user.firstName + ' ' + user.lastName,
            rankingProgress: positions.pop(),
            userId: user._id,
            members: [ObjectId(user._id)]
          })

          db.dailyStats.insert(dailyStat, done)
        })
      }, cb)
    },
    (stats, cb) => tasks.leaderboard({ db, mailer }, cb),
    (report, cb) => {
      t.equal(report.success, 2, '2 of 5 users receive emails')
      cb()
    }
  ], (err) => {
    t.ifError(err, 'no errors')
    t.end()
  })
})

test('Should render all the email data correctly', (t) => {
  t.plan(1)
  const tplData = {
    rankingProgress: 1,
    leagueName: 'Test leagueName',
    leagueId: 'leagueId',
    name: 'Name Here',
    frontendUrl: 'http://test.kudoshealth.com'
  }
  const example = artifacts['user-notify-leaderboard-update']
  t.equal(pugTpl(tplData), example, 'email template matches sample')
  t.end()
})

test('Close the database', (t) => {
  t.plan(1)
  db.close((err) => {
    t.ifError(err, 'db closed')
    t.end()
  })
})
