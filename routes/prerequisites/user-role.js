const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')
const { hasRole } = require('../../lib/roles')

// Restrict route to users with a particular role
// Requires config.auth = 'auth0' to be set on the route
module.exports = ({ db, role = 'user', assign = 'user', failAction = 'error' }) => ({
  method (request, reply) {
    const userId = ObjectId(request.auth.credentials)

    db.users.findOne({ _id: userId }, (err, user) => {
      if (err) return reply(err)
      if (!user) return reply(Boom.notFound('User not found'))
      if (!hasRole(user, role)) return reply(Boom.forbidden())
      reply(user)
    })
  },
  assign,
  failAction
})
