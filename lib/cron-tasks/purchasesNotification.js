const Async = require('async')
const moment = require('moment')
const config = require('config')

module.exports = function ({ db, mailer }, cb) {
  const lastRun = moment.utc().subtract(1, 'days').toDate()

  Async.waterfall([
    function getRecentPurchases (cb) {
      db.transactionLogs.aggregate([
        { $match: { createdAt: { $gte: lastRun }, type: 'purchase' } },
        { $group: { _id: '$company._id', count: { $sum: 1 }, purchases: { $addToSet: '$$ROOT' } } },
        { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'company' } },
        { $unwind: '$company' },
        { $unwind: '$company.moderators' },
        { $lookup: { from: 'users', localField: 'company.moderators.user', foreignField: '_id', as: 'moderator' } },
        { $unwind: '$moderator' },
        { $group: { _id: '$company._id', count: { $first: '$count' }, purchases: { $first: '$purchases' }, moderators: { $addToSet: '$moderator' } } }
      ], cb)
    },
    function sendMails (results, cb) {
      if (results.length < 1) return cb(null, results)
      Async.eachLimit(results, 5, ({ _id, count, purchases, moderators }, done) => {
        mailer.send('moderator-notify-purchases', null, {
          companyId: _id,
          count,
          purchases,
          bcc: moderators.map(({ emails }) => emails[0].address),
          frontendUrl: config.frontendUrl
        }, done)
      }, (err) => {
        // If any of the mails fail to send, log the fact but continue the waterfall
        if (err) console.error(err)
        cb(null, results)
      })
    }
    // function sendOrUpdateNotifications (results, cb) {
    //   Async.eachSeries(results, ({ _id, count, moderators }, done) => {
    //     const bulkNotifications = db.notifications.initializeUnorderedBulkOp()
    //     moderators.forEach(({ _id }) => {
    //       bulkNotifications.insert({
    //         user: { _id },
    //         type: 'purchase',
    //         messages: [`Members of your company have purchased ${count} rewards`],
    //         url: `/company/${_id}/transaction-log`,
    //         deleted: false
    //       })
    //     })
    //     bulkNotifications.execute(done)
    //   }, (err) => cb(err, results))
    // }
  ], (err, results) => {
    if (err) {
      console.error(err)
      if (cb) cb(err)
      return
    }
    if (cb) cb(null, results)
  })
}
