const Joi = require('joi')
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const Graph = require('../lib/graph')

module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/graph',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)

      db.users.findOne({ _id: userId, deleted: false }, (err, user) => {
        if (err) return reply(err)
        if (!user) return reply(Boom.create(404, 'User not found'))

        const {timespan, startDate, strategy} = request.query

        if (timespan === 'daily') {
          Graph.getDailyGraphData({ db, user, strategy, startDate }, (err, graphData) => {
            if (err) return reply(err)
            reply(graphData)
          })
        } else if (timespan === 'weekly') {
          Graph.getWeeklyGraphData({ db, user, strategy, startDate }, (err, graphData) => {
            if (err) return reply(err)
            reply(graphData)
          })
        } else {
          Graph.getMonthlyGraphData({ db, user, strategy, startDate }, (err, graphData) => {
            if (err) return reply(err)
            reply(graphData)
          })
        }
      })
    },
    config: {
      description: 'Get graph data. Optionally limit by strategy and change timespan and startDate',
      auth: 'auth0',
      validate: {
        query: {
          timespan: Joi.string().valid('daily', 'weekly', 'monthly').default('daily'),
          startDate: Joi.date().iso(),
          strategy: Joi.string().valid('fitbit', 'runkeeper', 'strava', 'google-fit')
        }
      }
    }
  }
}
