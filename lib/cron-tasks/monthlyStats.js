const async = require('async')
const companyStats = require('../stored-stats-corp-interface')
const config = require('config')

module.exports = function ({ db, mailer }, cb) {
  const getCompanyStats = companyStats(db)

  const findAllTheModerators = (done) => {
    const aggregateQuery = [
      {$match: {}},
      {$project: {companyId: '$_id', companyName: '$name', companyMembers: '$members', moderators: '$moderators.user'}},
      {$unwind: '$moderators'},
      {$lookup: {from: 'users', localField: 'moderators', foreignField: '_id', as: 'moderators'}},
      {$project: {companyId: '$_id', companyName: '$companyName', companyMembers: '$companyMembers', moderator: {$arrayElemAt: ['$moderators', 0]}}},
      {$project: {companyId: '$companyId', companyName: '$companyName', companyMembers: '$companyMembers', firstName: '$moderator.firstName', email: {$arrayElemAt: ['$moderator.emails', 0]}}},
      {$project: {companyId: '$companyId', companyName: '$companyName', companyMembers: '$companyMembers', firstName: '$firstName', email: '$email.address'}}
    ]
    db.companies.aggregate(aggregateQuery, done)
  }

  const compileCompanyStats = (moderators, cb) => {
    async.mapLimit(moderators, 2, (moderator, next) => {
      const company = { _id: moderator.companyId, name: moderator.companyName, members: moderator.companyMembers }
      getCompanyStats(company, (err, stats) => {
        next(err, { moderator, stats, frontendUrl: config.frontendUrl })
      })
    }, cb)
  }

  const sendMonthlyEmails = (dataForEmailing, done) => {
    async.mapLimit(dataForEmailing, 2, (emailTplData, next) => {
      if (!emailTplData.stats.standings) return next(null, {success: 0, fail: 1})
      mailer.send('moderator-monthly-stats', emailTplData.moderator.email, emailTplData, (err) => {
        if (err) return next(err, {success: 0, fail: 1})
        return next(null, {success: 1, fail: 0})
      })
    }, done)
  }

  const compileReports = (reports, cb) => {
    async.reduce(reports, {success: 0, fail: 0}, (report, email, done) => {
      report.success += email.success
      report.fail += email.fail
      done(null, report)
    }, cb)
  }

  async.waterfall([
    findAllTheModerators,
    compileCompanyStats,
    sendMonthlyEmails,
    compileReports
  ], (err, report) => {
    if (err) {
      console.error(err)
      if (cb) return cb(err)
      return
    }
    console.log(report)
    if (cb) cb(null, report)
  })
}
