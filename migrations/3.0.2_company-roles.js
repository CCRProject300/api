module.exports = function (cb) {
  const { db } = this
  db.companies.update({ roles: null }, { $set: { roles: [] } }, { multi: true }, cb)
}
