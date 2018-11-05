module.exports = function (cb) {
  const { db } = this
  db.users.update({ roles: { $ne: 'user' } }, { $addToSet: { roles: 'user' } }, { multi: true }, cb)
}
