const Async = require('async')

module.exports = function (cb) {
  const db = this.db

  db.users.find({emailPreferences: {$exists: false}}, (err, users) => {
    if (err) return cb(err)

    Async.each(users, (user, cb) => {
      const update = {
        $set: {
          emailPreferences: {
            league: true,
            podium: true,
            leaderboard: true,
            connected: true
          }
        }
      }

      db.users.update({ _id: user._id }, update, cb)
    }, cb)
  })
}
