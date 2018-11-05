const moment = require('moment')
const get = require('lodash.get')
const assignNonEmpty = require('../lib/assign-non-empty')

module.exports = function (cb) {
  const db = this.db
  const bulkUsers = db.users.initializeUnorderedBulkOp()

  db.users.find({ $or: [
    { height: null },
    { weight: null },
    { dob: null },
    { gender: null }
  ]}, (err, users) => {
    if (err) return cb(err)
    users.forEach((user) => {
      const strava = get((user.methods || []).find((m) => m.strategy === 'strava'), 'info.profile._json') || {}
      const fitbit = get((user.methods || []).find((m) => m.strategy === 'fitbit'), 'info.profile._json.user') || {}
      let $set = assignNonEmpty({
        sex: { key: 'gender', val: (v) => ({ M: 'Male', F: 'Female' })[v] },
        weight: 'weight'
      }, strava)
      assignNonEmpty({
        gender: { key: 'gender', val: (v) => ({ MALE: 'Male', FEMALE: 'Female' })[v] },
        dateOfBirth: { key: 'dob', val: (v) => v ? moment.utc(v).toDate() : v },
        weight: 'weight',
        height: 'height'
      }, fitbit, $set)
      bulkUsers.find({ _id: user._id }).updateOne({ $set })
    })
    bulkUsers.execute(cb)
  })
}
