// Add index on intervals
module.exports = function (cb) {
  const db = this.db
  db.intervals.createIndex({ userId: 1 }, cb)
}
