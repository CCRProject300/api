const async = require('async')
const moment = require('moment')
const config = require('config')

module.exports = function ({ db, mailer }, cb) {
  const today = moment.utc().startOf('day').toDate()

  async.waterfall([
    (cb) => db.dailyStats.aggregate([
      { $match: {type: 'leagueStandings', active: true, date: {$gte: today}} },
      { $unwind: '$members' },
      { $lookup: {from: 'users', localField: 'members', foreignField: '_id', as: 'user'} },
      { $unwind: '$user' },
      { $match: { 'user.emailPreferences.leaderboard': true, rankingProgress: { $ne: 0 } } },
      { $project: {'_id': 1, 'leagueName': 1, 'leagueId': 1, 'ranking': 1, 'rankingProgress': 1, 'name': 1, 'score': 1, 'user.emails': 1, 'user.firstName': 1, 'user.emailPreferences.leaderboard': 1} }
    ], cb),
    (results, cb) => {
      if (results.length < 1) return cb(new Error('no dailyStats results'))
      async.map(results, (task, done) => {
        const tplData = {
          rankingProgress: task.rankingProgress,
          leagueName: task.leagueName,
          leagueId: task.leagueId,
          name: task.name,
          frontendUrl: config.frontendUrl
        }
        mailer.send('user-notify-leaderboard-update', task.user.emails[0].address, tplData, (err) => {
          if (err) return done(err, {success: 0, fail: 1})
          done(null, {success: 1, fail: 0})
        })
      }, cb)
    },
    (reports, cb) => {
      async.reduce(reports, {success: 0, fail: 0}, (report, email, done) => {
        report.success += email.success
        report.fail += email.fail
        done(null, report)
      }, cb)
    }
  ], (err, report) => {
    if (err) {
      console.error(err)
      if (cb) return cb(err)
    }
    if (cb) cb(null, report)
  })
}
