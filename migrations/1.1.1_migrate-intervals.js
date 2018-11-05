const Async = require('async')
const moment = require('moment')
const config = require('config')
const khLib = require('kudoshealth-lib')

module.exports = function (cb) {
  const db = this.db
  const migrationStartDate = moment().subtract(3, 'months').startOf('day')

  // Rename old intervals collection
  db.intervals.rename('oldIntervals', (err) => {
    // Collection "intervals" doesn't exist
    if (err && (err.code === 26 || err.message === 'source namespace does not exist')) {
      console.warn('No existing intervals, skipping migration')
      return cb()
    }
    // Collection "oldIntervals" already exists
    if (err && (err.code === 48 || err.message === 'target namespace exists')) {
      console.warn('Old intervals collection already exists, skipping migration')
      return cb()
    }

    if (err) return cb(err)

    const now = moment()
    let startOfDay = moment(migrationStartDate)

    // Make the new intervals for the day in question
    Async.until(() => startOfDay.isAfter(now), (done) => {
      makeIntervalsForDay(startOfDay.toDate(), (err) => {
        if (err) return cb(err)
        startOfDay.add(1, 'days')
        done()
      })
    }, cb)
  })

  function makeIntervalsForDay (startOfDayDate, cb) {
    const endOfDayDate = moment(startOfDayDate).add(1, 'days').toDate()
    Async.waterfall([
      function getIntervals (done) {
        // The second stage in the pipeline is to remove duplicates
        db.oldIntervals.aggregate([
          { $match: { timestamp_end: { $gte: startOfDayDate }, timestamp_start: { $lte: endOfDayDate } } },
          { $group: { _id: { 1: '$timestamp_start', 2: '$timestamp_end', 3: '$method', 4: '$userId' }, unique: { $first: '$$ROOT' } } },
          { $group: { _id: { userId: '$unique.userId', method: '$unique.method' }, activities: { $push: '$unique' } } }
        ], done)
      },

      // activityArray looks like [{ _id: { userId: 'USER_ID', method: 'strava' }, activities: [{ }, { }, ...] }]
      function getUsers (activityArray, done) {
        const userIds = activityArray.map((entry) => entry._id.userId)
        db.users.find({ _id: { $in: userIds } }, (err, users) => {
          if (err) return cb(err)
          done(null, activityArray, users)
        })
      },

      function cycleThroughUsersAndMethods (activityArray, users, done) {
        Async.each(activityArray, (activityEntry, cb) => {
          const activities = formatActivities(activityEntry.activities)
          const user = users.find((u) => u._id.equals(activityEntry._id.userId))
          if (!user) {
            console.warn('User not found in interval update process')
            return cb()
          }
          khLib.intervals.storeAsIntervals({
            db,
            startDate: startOfDayDate.valueOf(),
            endDates: endOfDayDate.valueOf(),
            activities,
            user,
            method: activityEntry._id.method,
            intervalSize: config.intervalSize
          }, cb)
        }, (err) => {
          done(err, users)
        })
      },

      function promoteTopIntervals (users, done) {
        Async.each(users, (user, cb) => {
          khLib.promote(db, startOfDayDate.valueOf(), user, cb)
        }, done)
      }
    ], cb)
  }

  function formatActivities (oldIntervals) {
    return oldIntervals.map((oldInt) => {
      let newInt = {
        startDate: oldInt.timestamp_start.valueOf(),
        endDate: oldInt.timestamp_end.valueOf()
      }
      newInt.calsPerMilli = newInt.endDate === newInt.startDate ? 0 : oldInt.total_calories / (newInt.endDate - newInt.startDate)
      return newInt
    })
  }
}
