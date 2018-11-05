// Add simpler compound rawActivity index
module.exports = function (cb) {
  const db = this.db
  db.rawActivity.createIndex({ method: 1, userId: 1 }, cb)
}
