const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
const Async = require('async')
const moment = require('moment')
const config = require('config')
const Password = require('../lib/password')
const userReply = require('../lib/user-reply')
const checkUserVitalStats = require('../lib/check-user-vital-stats')

// Get user
module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/user',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)

      db.users.findOne({ _id: userId, deleted: false }, (err, user) => {
        if (err) return reply(err)
        if (!user) return reply(Boom.create(404, 'User not found'))
        userReply({ db, user }, (err, payload) => {
          if (err) return reply(err)
          reply(payload)
        })
      })
    },
    config: {
      description: 'Get the currently logged in user',
      auth: 'auth0'
    }
  }
}

// Create user
module.exports.post = ({ db, auth0Api }) => {
  return {
    method: 'POST',
    path: '/user',
    handler (request, reply) {
      const data = request.payload

      Async.waterfall([
        function ensureEmailAvailable (cb) {
          db.users.count({'emails.address': data.email}, (err, exists) => {
            if (err) return cb(err)
            if (exists) return cb(Boom.conflict('Email already taken'))
            cb()
          })
        },
        (cb) => Password.hash(data.password, cb),
        function checkInviteToken (hash, cb) {
          if (!request.query.token) return cb(null, null, hash)

          Async.waterfall([
            function getToken (cb) {
              db.tokens.findOne({
                _id: ObjectId(request.query.token),
                revoked: false
              }, cb)
            },
            function getCompany (token, cb) {
              if (!token) return cb(Boom.notFound('Token revoked or not recognised'))
              db.companies.findOne({
                _id: token.companyId,
                deleted: false
              }, cb)
            }
          ], (err, company) => {
            if (err) return cb(err)
            if (!company) return cb(Boom.notFound('Company has been deleted'))
            cb(null, company, hash)
          })
        },
        function checkJwt (company, hash, cb) {
          const token = request.headers.authorization

          auth0Api({
            method: 'POST',
            route: '/tokeninfo',
            json: {
              id_token: token
            },
            noAuth: true
          }, (err, res, body) => {
            if (err) return cb(err)
            if (res.statusCode !== 200) return cb(Boom.unauthorized('JWT verification failure'))
            cb(null, company, hash, body.user_id, token)
          })
        },
        function insertUser (company, hash, auth0Id, token, cb) {
          data.auth0Id = auth0Id
          data.emails = [{address: data.email, verified: false}] // Expand email
          delete data.email
          if (company) data.companyName = company.name

          const roles = company ? ['user'].concat(company.roles) : ['user']

          db.users.insert(Object.assign(data, {
            deleted: false,
            createdAt: moment.utc().toDate(),
            updatedAt: moment.utc().toDate(),
            roles
          }), (err, user) => cb(err, user, company, token))
        },
        function addUserToCompany (user, company, token, cb) {
          if (!company) return cb(null, token, user)
          db.companies.update({ _id: company._id }, {
            $push: {
              members: {
                user: user._id,
                startDate: moment.utc().toDate(),
                active: true,
                activated: true
              }
            }
          }, (err) => cb(err, token, user))
        },
        function createOnboardingNotification (token, user, cb) {
          db.notifications.insert({
            user: { _id: user._id },
            type: 'onboarding',
            messages: ['Welcome to Kudos Health! Ready to read our getting started guide?'],
            url: '/getting-started',
            deleted: false
          }, (err) => cb(err, token, user))
        },
        function createMissingStatsNotification (token, user, cb) {
          db.notifications.insert({
            user: { _id: user._id },
            type: 'missingStats',
            messages: ['Some of your personal details are missing, and you can\'t score Kudos points without them. Do you want to update them now?'],
            url: '/settings',
            deleted: false
          }, (err) => cb(err, token, user))
        }
      ], (err, token, user) => {
        if (err) return reply(err)
        userReply({ db, user }, (err, payload) => {
          if (err) return reply(err)
          reply(payload).code(201).header('Authorization', token)
        })
      })
    },
    config: {
      description: 'Register a new user',
      validate: {
        payload: {
          firstName: Joi.string().required(),
          lastName: Joi.string().required(),
          email: Joi.string().lowercase().email().required()
        },
        query: {
          token: Joi.objectId()
        },
        headers: Joi.object({
          authorization: Joi.string().required()
        }).options({ allowUnknown: true })
      },
      auth: false
    }
  }
}

// Update user
module.exports.patch = ({ db, uploadcare, auth0Api }) => {
  return {
    method: 'PATCH',
    path: '/user',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)
      const data = request.payload
      const { email, password } = data
      delete data.email
      delete data.password

      Async.waterfall([
        function findUser (cb) {
          db.users.findOne({ _id: userId, deleted: false }, (err, user) => {
            if (err) return cb(err)
            if (!user) return cb(Boom.notFound('User not found'))
            cb(null, user)
          })
        },
        function updateEmailOrPasswordOnAuth0 (user, cb) {
          if (!email && !password) return cb(null, user)
          const json = {
            client_id: config.auth0Backend.clientId,
            connection: config.auth0.connection
          }
          if (email) json.email = email
          if (password) json.password = password

          auth0Api({
            method: 'PATCH',
            route: `/api/v2/users/${user.auth0Id}`,
            json
          }, (err, res, body) => {
            if (err) return cb(err)
            if (res.statusCode !== 200) return cb(Boom.badRequest('Could not update user email on Auth0', body))
            cb(null, user)
          })
        },
        function updateEmailLocally (user, cb) {
          if (!email) return cb(null, user)

          const emails = user.emails
          const existingEmail = user.emails.find((e) => e.address === email)

          if (existingEmail) { // Already exists, make default
            data.emails = [existingEmail].concat(emails.filter((e) => e !== existingEmail))
          } else { // New email
            data.emails = [{address: email, verified: false}].concat(emails)
          }

          cb(null, user)
        },
        function updateUser (user, cb) {
          data.updatedAt = moment.utc().toDate()
          db.users.update({ _id: userId }, { $set: data }, (err) => {
            if (err) return cb(err)
            checkUserVitalStats(db, user)
            cb()
          })
        },
        function persistAvatar (cb) {
          uploadcare.store(data.avatar)
          cb()
        },
        function findUser (cb) {
          db.users.findOne({ _id: userId }, cb)
        }
      ], (err, user) => {
        if (err) return reply(err)
        userReply({ db, user }, (err, payload) => {
          if (err) return reply(err)
          reply(payload)
        })
      })
    },
    config: {
      description: 'Update user details',
      validate: {
        payload: {
          firstName: Joi.string(),
          lastName: Joi.string(),
          email: Joi.string().lowercase().email(),
          password: Joi.string(),
          started: Joi.boolean(),
          avatar: Joi.string().uri(),
          department: Joi.string(),
          location: Joi.string(),
          height: Joi.number().min(50),
          weight: Joi.number().min(0),
          gender: Joi.string().valid('Male', 'Female', 'Other'),
          dob: Joi.date(),
          emailPreferences: Joi.object().keys({
            league: Joi.boolean(),
            podium: Joi.boolean(),
            leaderboard: Joi.boolean(),
            connected: Joi.boolean()
          })
        }
      },
      auth: 'auth0'
    }
  }
}
