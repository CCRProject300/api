const ObjectId = require('mongojs').ObjectId
const moment = require('moment')
const Async = require('async')
const Boom = require('boom')

module.exports = function (db) {
  function distrubuteDailyCoin ({ requestedAt, userId }, cb) {
    // Did a daily coin get distrubuted today for this user?
    db.transactionLogs.count({
      'user._id': userId,
      type: 'daily-coin',
      'data.requestedAt': { $gt: moment(requestedAt).startOf('day').toDate() }
    }, (err, exists) => {
      if (err) return cb(err)

      // Yes, already exists, nothing to do
      if (exists) return cb()

      db.users.findOne(
        { _id: userId, deleted: false },
        { _id: 1, avatar: 1, firstName: 1, lastName: 1 },
        (err, user) => {
          if (err) return cb(err)
          if (!user) return cb(Boom.notFound('User not found'))

          const { _id, avatar, firstName, lastName } = user

          const log = {
            user: { _id, avatar, firstName, lastName },
            kudosCoins: 1,
            reason: `You used the KudosHealth app on ${moment(requestedAt).format('ddd Do MMM YYYY hh:ss')}`,
            createdAt: new Date(),
            type: 'daily-coin',
            createdBy: { _id, avatar, firstName, lastName },
            data: { requestedAt }
          }

          Async.parallel([
            (cb) => db.transactionLogs.insert(log, cb),
            (cb) => db.users.update({_id: user._id}, { $inc: { kudosCoins: 1 } }, cb)
          ], cb)
        })
    })
  }

  const queue = Async.queue(distrubuteDailyCoin, 1)

  queue.error = (err, { userId }) => {
    console.error(`Failed to distribute daily coin to ${userId}`, err)
  }

  return function (request, reply) {
    if (request.auth.credentials) {
      const requestedAt = new Date()
      const userId = ObjectId(request.auth.credentials)
      queue.push({ requestedAt, userId })
    }
    reply.continue()
  }
}
