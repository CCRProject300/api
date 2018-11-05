const Async = require('async')
const ObjectId = require('mongojs').ObjectId

module.exports = function (cb) {
  const db = this.db

  db.intervals.count({}, (err, total) => {
    if (err) return cb(err)
    if (!total) return cb()

    const q = Async.queue((interval, cb) => {
      if (!isString(interval.userId)) return cb()
      const query = { _id: interval._id }
      const update = { $set: { userId: ObjectId(interval.userId) } }
      db.intervals.update(query, update, cb)
    })

    db.intervals.find({})
      .on('data', (interval) => q.push(interval))
      .on('error', (err) => cb(err))
      .on('end', () => {
        if (q.idle()) return cb(err)
        q.drain = () => cb()
      })
  })
}

function isString (obj) {
  return Object.prototype.toString.call(obj) === '[object String]'
}
