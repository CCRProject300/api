module.exports = function (cb) {
  this.db.intervals.update({types: {$exists: false}}, {$set: {types: []}}, {multi: true}, cb)
}
