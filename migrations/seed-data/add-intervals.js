const Faker = require('faker')
const Async = require('async')
const moment = require('moment')

/* Add some intervals for a user and hand them back */
module.exports = (db, user, intervalCount, cb) => {
  const now = moment.utc()
  const monthAgo = moment(now).subtract(1, 'months')
  const methods = ['strava', 'fitbit', 'runkeeper']
  Async.times(intervalCount, (_, done) => {
    const method = Faker.random.arrayElement(methods)
    const end = moment(Faker.date.between(monthAgo.toDate(), now.toDate()))
    const start = moment(end).subtract(Faker.random.number(60 * 60 * 3), 'seconds')
    const duration = end.utc().diff(start.utc()) / 1000
    const caloriesPerSecond = Math.random() / 4
    db.intervals.insert({
      insertion_lag_ms: 15 * 60 * 1000,
      is_tracker: method === 'fitbit',
      timestamp_start: start.toDate(),
      timestamp_end: end.toDate(),
      method,
      userId: user._id,
      calories_per_second: caloriesPerSecond,
      calories: caloriesPerSecond * duration
    }, done)
  }, (err) => {
    if (err) return cb(err)
    console.log(`Added ${intervalCount} intervals to ${user.firstName} ${user.lastName}`)
    cb(null)
  })
}
