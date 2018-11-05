const Async = require('async')

module.exports = function (cb) {
  const db = this.db

  db.users.find({}, (err, users) => {
    if (err) return cb(err)

    Async.each(users, (user, cb) => {
      if (user.deleted != null) return cb()

      const query = { _id: user._id }
      const update = { $set: { deleted: false } }

      db.users.update(query, update, cb)
    }, cb)
  })
}
