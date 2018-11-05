const Async = require('async')
const ObjectId = require('mongojs').ObjectId

module.exports = function (cb) {
  const db = this.db

  db.groups.find({}, (err, groups) => {
    if (err) return cb(err)

    Async.each(groups, (group, cb) => {
      const members = (group.members || []).map((m) => {
        m.user = ObjectId(m.user)
        return m
      })

      const moderators = (group.moderators || []).map((m) => {
        m.user = ObjectId(m.user)
        return m
      })

      const query = { _id: group._id }
      const update = { $set: { moderators, members } }

      db.groups.update(query, update, cb)
    }, cb)
  })
}
