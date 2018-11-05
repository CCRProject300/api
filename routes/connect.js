const Joi = require('joi')
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const moment = require('moment')
const userReply = require('../lib/user-reply')
const checkUserVitalStats = require('../lib/check-user-vital-stats')
const revokeToken = require('../lib/revoke-token')

module.exports.connect = ({ db }) => ({
  method: 'POST',
  path: '/connect/{app}',
  handler (request, reply) {
    const app = request.params.app
    const query = { _id: ObjectId(request.auth.credentials), deleted: false }

    db.users.findOne(query, { methods: 1, height: 1, weight: 1, dob: 1, gender: 1 }, (err, user) => {
      if (err) return reply(err)
      if (!user) return reply(Boom.create(404, 'User not found'))

      const method = (user.methods || []).find((m) => m.strategy === app)
      const update = { $set: { updatedAt: moment.utc().toDate() } }

      if (method) {
        // Update query to allow us to use $ positional operator in the update
        query['methods.strategy'] = app

        update.$set['methods.$.info.token'] = request.payload.accessToken

        if (request.payload.refreshToken) {
          update.$set['methods.$.info.tokenSecret'] = request.payload.refreshToken
        }

        if (request.payload.profile) {
          if (request.payload.profile.id) {
            update.$set['methods.$.info.id'] = request.payload.profile.id
          }

          update.$set['methods.$.info.profile'] = Object.assign(method.info.profile, request.payload.profile)
        }
      } else {
        update.$push = {
          methods: {
            strategy: app,
            name: app[0].toUpperCase() + app.slice(1),
            has_tracker: false,
            last_tracker_update_date: moment.utc().toDate(),
            last_tracker_check_date: moment.utc().toDate(),
            last_tracker_update_value: 0,
            info: { token: request.payload.accessToken }
          }
        }

        if (request.payload.refreshToken) {
          update.$push.methods.info.tokenSecret = request.payload.refreshToken
        }

        if (request.payload.profile) {
          if (request.payload.profile.id) {
            update.$push.methods.info.id = request.payload.profile.id
          }

          update.$push.methods.info.profile = request.payload.profile
        }
      }

      ;['height', 'weight', 'dob', 'gender'].forEach((field) => {
        if (request.payload.profile[field] && !user[field]) {
          update.$set[field] = request.payload.profile[field]
        }
      })

      db.users.findAndModify({ query, update, new: true }, (err, user) => {
        if (err) return reply(err)
        checkUserVitalStats(db, user)
        userReply({ db, user }, (err, payload) => {
          if (err) return reply(err)
          reply(payload)
        })
      })
    })
  },
  config: {
    validate: {
      params: {
        app: Joi.string().valid('fitbit', 'runkeeper', 'strava', 'google-fit').required()
      },
      payload: {
        accessToken: Joi.string().required(),
        refreshToken: Joi.string(),
        profile: Joi.object().keys({
          id: Joi.string(),
          avatar: Joi.string().uri({ scheme: ['http', 'https'] }),
          email: Joi.string().email(),
          gender: Joi.string().valid('Male', 'Female', 'Other'),
          height: Joi.number().min(50),
          weight: Joi.number().min(0),
          dob: Joi.date().iso(),
          city: Joi.string(),
          state: Joi.string(),
          country: Joi.string()
        }).required()
      }
    },
    auth: 'auth0'
  }
})

module.exports.disconnect = ({ db }) => ({
  method: 'POST',
  path: '/disconnect/{app}',
  handler (request, reply) {
    const app = request.params.app
    const query = { _id: ObjectId(request.auth.credentials) }

    db.users.findOne(query, { methods: 1 }, (err, user) => {
      if (err) return reply(err)
      if (!user) return reply(Boom.create(404, 'User not found'))

      const method = (user.methods || []).find((m) => m.strategy === app)
      if (!method) return reply(Boom.badRequest(`User is not connected to ${app}`))

      const update = { $pull: { methods: { strategy: app } } }

      db.users.findAndModify({ query, update, new: true }, (err, user) => {
        if (err) return reply(err)

        revokeToken(app, method.info.token, (err) => {
          if (err) console.warn(`Could not revoke token for strategy ${app} for user ${user.firstName} ${user.lastName}`)
          userReply({ db, user }, (err, payload) => {
            if (err) return reply(err)
            reply(payload)
          })
        })
      })
    })
  },
  config: {
    validate: {
      params: {
        app: Joi.string().valid('fitbit', 'runkeeper', 'strava', 'google-fit').required()
      }
    },
    auth: 'auth0'
  }
})
