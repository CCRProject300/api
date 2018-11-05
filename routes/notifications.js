const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const Joi = require('joi')
const moment = require('moment')
const createUserNotificationPre = require('./prerequisites/user-notification')
const makeNotificationHandler = require('../lib/notification-handler')

// Get notifications
module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/notifications',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)

      db.notifications.find({ 'user._id': userId, redeemedAt: null, deleted: false }, (err, notifications) => {
        if (err) return reply(err)
        reply(notifications)
      })
    },
    config: {
      description: 'Get notifications for a logged in user',
      auth: 'auth0'
    }
  }
}

module.exports.confirm = ({ db }) => {
  const notificationHandler = makeNotificationHandler(db)

  return {
    method: 'POST',
    path: '/notifications/{notificationId}/confirm',
    handler (request, reply) {
      Async.waterfall([
        function handleNotificationAction (cb) {
          notificationHandler({
            userId: ObjectId(request.auth.credentials),
            notification: request.pre.notification,
            confirm: true,
            data: request.payload && request.payload.data
          },
          cb)
        },
        function redeemNotification (cb) {
          db.notifications.update({ _id: request.pre.notification._id }, { $set: { redeemedAt: moment.utc().toDate() } }, cb)
        }
      ], (err, res) => {
        if (err) return reply(err)
        reply(res)
      })
    },
    config: {
      description: 'Confirm a notification with the supplied (optional) payload',
      auth: 'auth0',
      validate: {
        params: {
          notificationId: Joi.objectId().required()
        },
        payload: Joi.object({
          data: Joi.object()
        }).allow(null)
      },
      pre: [
        createUserNotificationPre({ db })
      ]
    }
  }
}

module.exports.reject = ({ db }) => {
  const notificationHandler = makeNotificationHandler(db)

  return {
    method: 'POST',
    path: '/notifications/{notificationId}/reject',
    handler (request, reply) {
      Async.waterfall([
        function handleNotificationAction (cb) {
          notificationHandler({
            userId: ObjectId(request.auth.credentials),
            notification: request.pre.notification,
            confirm: false
          },
          cb)
        },
        function redeemNotification (cb) {
          db.notifications.update({ _id: request.pre.notification._id }, { $set: { redeemedAt: moment.utc().toDate() } }, cb)
        }
      ], (err, res) => {
        if (err) return reply(err)
        reply(res)
      })
    },
    config: {
      description: 'Reject a notification',
      auth: 'auth0',
      validate: {
        params: {
          notificationId: Joi.objectId().required()
        }
      },
      pre: [
        createUserNotificationPre({ db })
      ]
    }
  }
}
