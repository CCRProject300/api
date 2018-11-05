// Add index on rawActivity
module.exports = function (cb) {
  this.db.rawActivity.createIndex({ uri: 1, strategy: 1, userId: 1 }, cb)
}
