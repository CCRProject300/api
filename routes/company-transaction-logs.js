const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Async = require('async')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/transaction-logs',
  handler (request, reply) {
    const { skip, limit } = request.query
    const query = {
      'company._id': request.pre.company._id,
      type: { $in: ['purchase', 'donation', 'distribution'] }
    }

    Async.parallel({
      total: (done) => db.transactionLogs.count(query, done),
      logs: (done) => {
        db.transactionLogs.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit, done)
      }
    }, (err, res) => {
      if (err) return reply(err)

      reply(Object.assign(res, { skip, limit }))
    })
  },
  config: {
    description: 'Get company transaction-log',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      },
      query: {
        skip: Joi.number().integer().min(0).default(0),
        limit: Joi.number().integer().positive().max(100).default(50)
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})
