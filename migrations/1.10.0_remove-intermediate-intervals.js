// Remove erroneously saved intevals which do not start on a round 15 minutes
module.exports = function (cb) {
  this.db.intervals.remove({ startDate: { $not: { $mod: [900000, 0] } } }, cb)
}
