// Add auth0Id index on user docs
module.exports = function (cb) {
  const db = this.db
  db.users.createIndex({ auth0Id: 1 }, cb)
}
