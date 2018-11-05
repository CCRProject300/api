const Async = require('async')
const collections = require('../../lib/db').collections

module.exports = (db, cb) => {
  const tasks = collections.map((c) => {
    return (cb) => {
      if (!db[c]) return cb()
      db[c].remove({}, cb)
    }
  })

  Async.parallel(tasks, (err) => cb(err))
}
