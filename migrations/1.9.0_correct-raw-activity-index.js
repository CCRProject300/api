// Add correct index on rawActivity, removing old index
module.exports = function (cb) {
  this.db.rawActivity.createIndex({ dateTime: 1, strategy: 1, userId: 1 }, (err) => {
    if (err) return cb(err)
    this.db.rawActivity.dropIndex({ uri: 1, strategy: 1, userId: 1 }, cb)
  })
}
