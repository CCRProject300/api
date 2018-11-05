const config = require('config')
const Async = require('async')
const ObjectId = require('mongojs').ObjectId

module.exports = function ({ db, mailer, league, userIds, panelId }, cb) {
  userIds = userIds.map((str) => ObjectId(str))
  Async.waterfall([
    function getPanel (cb) {
      if (!panelId) return cb(null, null)
      const fields = { _id: 1, name: 1 }
      db.panels.findOne({ _id: panelId }, fields, cb)
    },
    function addNotifications (panel, cb) {
      let notification = {
        type: 'joinedLeague',
        group: { _id: league._id, name: league.name },
        deleted: false
      }
      if (panel) {
        notification.messages = [`You have been added to the league "${league.name}" in the category "${panel.name}"`]
      } else {
        notification.messages = [`You have been added to the league "${league.name}"`]
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
        cb(null, notification, panel, userIds)
      })
    },
    function sendEmailNotifications (notification, panel, userIds, cb) {
      if (!mailer) return cb()
      db.users.find({_id: {$in: userIds}, 'emailPreferences.league': true}, (err, emailUsers) => {
        if (err) return console.error(err)
        Async.each(emailUsers, (user, sent) => {
          mailer.send(
            'user-joined-a-league',
            user.emails[0].address,
            {leagueName: notification.group.name, panelName: panel && panel.name, frontendUrl: config.frontendUrl},
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
