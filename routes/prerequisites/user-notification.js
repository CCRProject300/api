const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')

// Restrict route to the user who owns the given notification
// Requires {notificationId} path param and config.auth = 'auth0' to be set on the route
module.exports = ({ db }) => ({
  method (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const notificationId = ObjectId(request.params.notificationId)
    const query = {
      _id: notificationId,
      'user._id': userId,
      deleted: false,
      redeemedAt: null
    }

    db.notifications.findOne(query, (err, notification) => {
      if (err) return reply(err)
      if (!notification) return reply(Boom.forbidden())
      reply(notification)
    })
  },
  assign: 'notification'
})
