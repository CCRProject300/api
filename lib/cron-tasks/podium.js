const async = require('async')
const config = require('config')
const moment = require('moment')

module.exports = function ({ db, mailer }, cb) {
  const today = moment.utc().startOf('day').toDate()

  async.waterfall([
    (cb) => {
      db.dailyStats.aggregate([
        { $match: { type: 'companyRankings', date: {$gte: today} } },
        { $lookup: {from: 'companies', localField: 'companyId', foreignField: '_id', as: 'company'} },
        { $unwind: '$company' },
        { $unwind: '$company.members' },
        { $match: {'company.members.active': true, 'company.members.activated': true} },
        { $lookup: {from: 'users', localField: 'company.members.user', foreignField: '_id', as: 'user'} },
        { $unwind: '$user' },
        { $match: {'user.deleted': false} },
        { $project: {'companyName': 1, 'podium': 1, 'date': 1, 'user': 1, 'companyAvg': 1} }
      ], cb)
    },
    (results, cb) => {
      if (results.length < 1) return cb(new Error('no podium results'))

      const emailTasks = results.filter((result) => {
        const emailPreferences = result.user.emailPreferences || {}
        return emailPreferences.podium === true
      })

      async.map(emailTasks, (task, done) => {
        const tplData = {
          name: task.user.firstName,
          frontendUrl: config.frontendUrl,
          podium: task.podium || [],
          companyName: task.companyName
        }

        mailer.send('user-notify-podium-places', task.user.emails[0].address, tplData, (err) => {
          if (err) return done(err, {success: 0, fail: 1})
          done(null, {success: 1, fail: 0})
        })
      }, cb)
    },
    (reports, cb) => {
      const report = reports.reduce((report, email) => {
        report.success += email.success
        report.fail += email.fail
        return report
      }, {success: 0, fail: 0})
      cb(null, report)
    }
  ], (err, report) => {
    if (err) {
      console.error(err)
      if (cb) return cb(err)
    }
    if (cb) cb(null, report)
  })
}
