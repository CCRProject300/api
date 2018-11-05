const moment = require('moment')
const Async = require('async')

// Shifts startOfDay values to be in line with the start of UTC days, rather than local days
module.exports = function (cb) {
  const db = this.db
  const LIMIT = 500
  const startOfTodayUTC = moment.utc().startOf('day').valueOf()
  const lengthOfDay = 1000 * 60 * 60 * 24

  var skip = 0
  var finished = false

  Async.until(
    () => finished,
    (done) => {
      db.intervals.find({}).skip(skip).limit(LIMIT, (err, intervals) => {
        if (err) return cb(err)
        if (!intervals.length) {
          finished = true
          return done()
        }

        const bulk = db.intervals.initializeUnorderedBulkOp()
        const updates = intervals.reduce((updates, interval) => {
          // find the proportion of a day by which the interval startOfDay differs from a UTC startOfDay
          const offset = (startOfTodayUTC - interval.startOfDay) % lengthOfDay
          if (offset) {
            updates.push({
              query: { _id: interval._id },
              mutation: {
                $inc: {
                  startOfDay: offset
                }
              }
            })
          }
          return updates
        }, [])

        updates.forEach((update) => {
          bulk.find(update.query).updateOne(update.mutation)
        })
        bulk.execute((err) => {
          if (err) return done(err)
          skip += LIMIT
          done()
        })
      })
    }, cb)
}
