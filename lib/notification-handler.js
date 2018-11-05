const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')
const Actions = require('./actions')

const noop = (data, cb) => {
  process.nextTick(cb)
}

module.exports = function (db) {
  const actions = Actions(db)

  const handlers = {
    onboarding: noop,

    missingStats: noop,

    disconnectedMethod: noop,

    joinedLeague: noop,

    indLeagueInvite ({ userId, notification, confirm }, cb) {
      if (!userId.equals(notification.user._id)) return cb(Boom.forbidden('Notification is not for this user'))
      const leagueId = ObjectId(notification.group._id)
      actions.joinIndividualLeague({ userId, leagueId, confirm }, cb)
    },

    groupLeagueInvite ({ userId, notification, confirm, data }, cb) {
      if (!userId.equals(notification.user._id)) return cb(Boom.forbidden('Notification is not for this user'))
      const leagueId = ObjectId(notification.group._id)
      const panelId = data && data.panelId && ObjectId(data.panelId)
      actions.joinGroupLeague({ userId, leagueId, panelId, confirm }, cb)
    },

    companyInvite ({ userId, notification, confirm }, cb) {
      if (!userId.equals(notification.user._id)) return cb(Boom.forbidden('Notification is not for this user'))
      const companyId = ObjectId(notification.group._id)
      actions.joinCompany({ userId, companyId, confirm }, cb)
    },

    corpModInvite ({ userId, notification, confirm }, cb) {
      if (!userId.equals(notification.user._id)) return cb(Boom.forbidden('Notification is not for this user'))
      const companyId = ObjectId(notification.group._id)
      actions.joinCompanyAsCorpMod({ userId, companyId, confirm }, cb)
    }
  }

  return function ({ userId, notification, confirm, data }, cb) {
    const handler = handlers[notification.type]
    if (!handler) return cb(new Error(`Missing handler for notification "${notification.type}"`))
    handler({ userId, notification, confirm, data }, cb)
  }
}
