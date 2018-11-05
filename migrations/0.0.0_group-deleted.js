const Async = require('async')

module.exports = function (cb) {
  const db = this.db

  db.groups.find({}, (err, groups) => {
    if (err) return cb(err)

    Async.each(groups, (group, cb) => {
      if (group.deleted != null) return cb()

      const query = { _id: group._id }
      const update = { $set: { deleted: false } }

      db.groups.update(query, update, cb)
    }, cb)
  })
}
