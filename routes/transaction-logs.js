const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Async = require('async')
const ObjectId = require('mongojs').ObjectId
const createUserRolePre = require('./prerequisites/user-role')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/transaction-logs',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const { skip, limit, types } = request.query
    const query = { 'user._id': userId, type: { $in: types } }

    Async.parallel({
      total: (cb) => db.transactionLogs.count(query, cb),
      logs: (cb) => {
        db.transactionLogs.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit, cb)
      }
    }, (err, res) => {
      if (err) return reply(err)
      reply(Object.assign(res, { skip, limit, types }))
    })
  },
  config: {
    description: 'Get transaction logs for the logged in user, sorted in reverse chronological order',
    auth: 'auth0',
    validate: {
      query: {
        skip: Joi.number().integer().min(0).default(0),
        limit: Joi.number().integer().positive().max(100).default(50),
        types: Joi.array()
          .items(
            Joi.string().valid(
              'purchase',
              'distribution',
              'donation',
              'daily-coin',
              'activity',
              'activity-adjustment'
            )
          )
          .single()
          .default([
            'purchase',
            'distribution',
            'donation',
            'daily-coin',
            'activity',
            'activity-adjustment'
          ])
      }
    },
    pre: [
      createUserRolePre({ db, role: 'rewards' })
    ]
  }
})
