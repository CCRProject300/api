const moment = require('moment')

// Asynchronously auto-redeem missing stats notification if stats are complete
// There is no callback parameter - errors are logged
module.exports = function (db, user) {
  db.users.findOne({ _id: user._id }, (err, user) => {
    if (err) return console.error(err)
    if (!user) return console.error(`Cannot check vital stats for unknown user ${user._id}`)

    const statsComplete = ['height', 'weight', 'dob', 'gender'].every(stat => !!user[stat])
    if (statsComplete) {
      db.notifications.update({
        'user._id': user._id,
        type: 'missingStats',
        deleted: false,
        redeemedAt: null
      }, { $set: { redeemedAt: moment.utc().toDate() } })
    }
  })
}
