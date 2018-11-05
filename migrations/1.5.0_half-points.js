const ObjectId = require('mongojs').ObjectId
const Async = require('async')

// Half points for Lisa Cunningham when her height was set at 125
module.exports = function (cb) {
  const db = this.db
  const userId = ObjectId('57d168f3edd6d6226be7df8b')
  const height = 125
  const startDate = { $lt: new Date('2016-09-15T07:15:01.000Z').getTime() }
  const kudosPoints = { $gt: 0 }

  const query = { userId, height, startDate, kudosPoints }
  db.intervals.find(query, (err, intervals) => {
    if (err) return cb(err)

    Async.eachLimit(intervals, 5, (interval, cb) => {
      const query = { _id: interval._id }
      const update = {
        $set: {
          kudosPoints: interval.kudosPoints / 2,
          _kudosPoints: interval.kudosPoints // Save the old points just in case!
        }
      }
      db.intervals.update(query, update, cb)
    }, cb)
  })
}
