const ObjectId = require('mongojs').ObjectId
const moment = require('moment')

module.exports = function getAverageKudosCoins (db, company, cb) {
  const endOfPeriod = moment.utc().days(0).endOf('day').toDate()
  const startOfPeriod = moment.utc(endOfPeriod).subtract(9, 'weeks').startOf('day').toDate()

  const match = {
    'company._id': ObjectId(company._id),
    type: { $in: ['activity', 'activity-adjustment'] },
    $and: [
      { createdAt: {$gte: startOfPeriod} },
      { createdAt: {$lte: endOfPeriod} }
    ]
  }

  const aggregation = [
    {$match: match},
    {$project: {company: '$company._id', user: '$user._id', kudosCoins: '$kudosCoins', day: '$data.startOfDay'}},
    {$group: {_id: {user: '$user', day: '$day'}, company: {$first: '$company'}, kudosCoins: {$sum: '$kudosCoins'}}},
    {$group: {_id: '$company', kudosCoins: {$avg: '$kudosCoins'}}}
  ]

  db.transactionLogs.aggregate(aggregation, (err, [result]) => {
    if (err) return cb(err)
    if (!result) return cb(null, 0)
    cb(err, result.kudosCoins * 7)
  })
}
