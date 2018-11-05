// Moves user "role" into a single-entry "roles" array, or else sets "roles" to be ["user"]

module.exports = function (cb) {
  const bulkUsers = this.db.users.initializeUnorderedBulkOp()

  this.db.users.find({ roles: { $exists: false } }, { _id: 1, role: 1 }, (err, users) => {
    if (err) return cb(err)

    users.forEach((user) => {
      const roles = user.role ? [user.role] : ['user']
      bulkUsers.find({ _id: user._id }).updateOne({ $set: { roles }, $unset: { role: true } })
    })

    bulkUsers.execute(cb)
  })
}
