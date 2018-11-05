const config = require('config')
const Async = require('async')
const ObjectId = require('mongojs').ObjectId

module.exports = function ({ db, mailer, league, userIds }, cb) {
  userIds = userIds.map((str) => ObjectId(str))
  Async.waterfall([
    function getPanels (cb) {
      if (league.teamSize === 1) return cb(null, null)
      const $in = (league.panel || []).map((p) => p.panelId)
      const query = { _id: { $in }, deleted: false }
      const fields = { _id: 1, name: 1 }

      db.panels.find(query, fields, cb)
    },
    function addNotifications (panels, cb) {
      let notification
      if (league.teamSize === 1) {
        notification = {
          type: 'indLeagueInvite',
          group: { _id: league._id, name: league.name },
          messages: ['You have been invited to join the league ', 'Do you want to accept?'],
          deleted: false
        }
      } else {
        notification = {
          type: 'groupLeagueInvite',
          group: { _id: league._id, name: league.name },
          messages: ['You have been invited to join the league ', 'Select a group to join.', 'Do not join'],
          panels,
          deleted: false
        }
      }
      const bulkNotificationOp = db.notifications.initializeUnorderedBulkOp()
      userIds.forEach((userId) => {
        bulkNotificationOp.find({
          'user._id': userId,
          'group._id': league._id,
          type: notification.type
        }).upsert().replaceOne(Object.assign({ user: { _id: userId } }, notification))
      })
      bulkNotificationOp.execute((err) => {
        if (err) return cb(err)
        cb(null, notification, userIds)
      })
    },
    function sendEmailNotifications (notification, userIds, cb) {
      if (!mailer) return cb()
      db.users.find({_id: {$in: userIds}, 'emailPreferences.league': true}, (err, emailUsers) => {
        if (err) return console.error(err)
        Async.each(emailUsers, (user, sent) => {
          mailer.send(
            'user-added-to-league',
            user.emails[0].address,
            {leagueName: notification.group.name, frontendUrl: config.frontendUrl},
            (err) => {
              if (err) return sent(err)
              sent()
            })
        }, (err) => {
          // Log and keep rolling if email fails.
          if (err) console.error(err)
          cb()
        })
      })
    }
  ], (err) => {
    if (err) return cb(err)
    cb()
  })
}
