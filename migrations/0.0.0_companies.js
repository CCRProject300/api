const Async = require('async')

module.exports = function (cb) {
  const db = this.db

  Async.parallel([
    (cb) => {
      db.groups.update({
        __t: 'Company',
        $or: [
          { locations: { $exists: false } },
          { locations: { $size: 0 } }
        ]
      }, { $set: { locations: ['Default'] } }, { multi: true }, cb)
    },
    (cb) => {
      db.groups.update({
        __t: 'Company',
        $or: [
          { departments: { $exists: false } },
          { departments: { $size: 0 } }
        ]
      }, { $set: { departments: ['Default'] } }, { multi: true }, cb)
    }
  ], cb)
}
