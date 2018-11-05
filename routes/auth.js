const Boom = require('boom')
const Joi = require('joi')
const Async = require('async')
const Password = require('../lib/password')

// Login
module.exports.emailPassword = ({ db }) => {
  return {
    method: 'POST',
    path: '/auth/email-password',
    handler (request, reply) {
      const email = request.payload.email
      const password = request.payload.password

      Async.waterfall([
        function findUser (cb) {
          const query = { 'emails.address': email }
          const fields = { _id: 1, password: 1, deleted: 1, emails: 1, firstName: 1, lastName: 1 }

          db.users.findOne(query, fields, (err, user) => {
            if (err) return cb(err)
            if (!user) return cb(Boom.unauthorized('Email and password do not match'))
            if (user.deleted) return cb(Boom.notFound('User not found'))
            cb(null, user)
          })
        },
        function checkPassword (user, cb) {
          Password.compare(password, user.password, function (err, isMatch) {
            if (err) return cb(err)
            if (!isMatch) return cb(Boom.unauthorized('Email and password do not match'))
            cb(null, user)
          })
        }
      ], (err, user) => {
        if (err) return reply(err)
        reply({
          email: user.emails[0].address,
          email_verified: user.emails[0].verified,
          user_id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          nickname: user.firstName,
          given_name: user.firstName,
          family_name: user.lastName
        })
      })
    },
    config: {
      validate: {
        payload: {
          email: Joi.string().lowercase().email().required(),
          password: Joi.string().required()
        }
      },
      auth: false
    }
  }
}

module.exports.email = ({ db }) => {
  return {
    method: 'POST',
    path: '/auth/email',
    handler (request, reply) {
      const email = request.payload.email

      const query = { 'emails.address': email }
      const fields = { _id: 1, deleted: 1, emails: 1, firstName: 1, lastName: 1 }

      db.users.findOne(query, fields, (err, user) => {
        if (err) return reply(err)
        if (!user) return reply(Boom.notFound('User not found'))

        reply({
          email: user.emails[0].address,
          email_verified: user.emails[0].verified,
          user_id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          nickname: user.firstName,
          given_name: user.firstName,
          family_name: user.lastName
        })
      })
    },
    config: {
      validate: {
        payload: {
          email: Joi.string().lowercase().email().required()
        }
      },
      auth: false
    }
  }
}
