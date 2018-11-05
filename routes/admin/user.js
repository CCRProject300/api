const Boom = require('boom')
const Async = require('async')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const createUserRolePre = require('../prerequisites/user-role')
const config = require('config')
const companyRoles = config.companyRoles || []

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/admin/user/{userId}',
  handler (request, reply) {
    const query = { _id: ObjectId(request.params.userId), deleted: false }
    const fields = { firstName: 1, lastName: 1, companyName: 1, emails: 1, roles: 1 }

    db.users.findOne(query, fields, (err, user) => {
      if (err) return reply(err)
      if (!user) return reply(Boom.notFound('User not found'))
      reply(user)
    })
  },
  config: {
    description: 'Get a user',
    auth: 'auth0',
    validate: {
      params: {
        userId: Joi.objectId().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.patch = ({ db }) => ({
  method: 'PATCH',
  path: '/admin/user/{userId}',
  handler (request, reply) {
    // Noop right now if no role!
    if (!request.payload.roles) return reply().code(204)

    const userId = ObjectId(request.params.userId)
    const query = { _id: userId }
    const update = { $set: { roles: request.payload.roles } }

    db.users.update(query, update, (err) => {
      if (err) return reply(err)

      const fields = { firstName: 1, lastName: 1, companyName: 1, emails: 1, roles: 1 }

      db.users.findOne(query, fields, (err, user) => {
        if (err) return reply(err)
        reply(user)
      })
    })
  },
  config: {
    description: 'Update a user',
    auth: 'auth0',
    validate: {
      params: {
        userId: Joi.objectId().required()
      },
      payload: {
        roles: Joi.array().items(Joi.string().valid(['user', 'corporate_mod', 'admin'].concat(companyRoles)))
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.delete = ({ db, auth0Api }) => ({
  method: 'DELETE',
  path: '/admin/user/{userId}',
  handler (request, reply) {
    const userId = ObjectId(request.params.userId)
    const query = { _id: userId }
    const update = { $set: { deleted: true } }

    Async.waterfall([
      function findUserObj (cb) {
        db.users.findOne(query, (err, user) => {
          if (err) return cb(err)
          if (!user) return cb(Boom.notFound('Cannot find user'))
          cb(null, user)
        })
      },
      function blockUserOnAuth0 (user, cb) {
        auth0Api({
          method: 'PATCH',
          route: `/api/v2/users/${user.auth0Id}`,
          json: { blocked: true }
        }, (err, res, body) => {
          if (err) return cb(err)
          if (res.statusCode !== 200) return cb(Boom.badRequest('Could not block user on Auth0', body))
          cb()
        })
      },
      function updateUserDoc (cb) {
        db.users.update(query, update, (err) => {
          if (err) return cb(err)
          cb()
        })
      },
      function deleteNotifications (cb) {
        db.notifications.update({
          'user._id': userId,
          deleted: false,
          redeemedAt: null
        }, { $set: { deleted: true } }, { multi: true }, (err) => {
          if (err) return cb(err)
          cb()
        })
      }
      // TODO: clean up group references
    ], (err) => {
      if (err) return reply(err)
      reply().code(204)
    })
  },
  config: {
    description: 'Delete a user',
    auth: 'auth0',
    validate: {
      params: {
        userId: Joi.objectId().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})
