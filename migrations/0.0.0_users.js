const Async = require('async')

module.exports = function (cb) {
  const db = this.db

  db.users.find({}, (err, users) => {
    if (err) return cb(err)

    Async.each(users, (user, cb) => {
      if (!user.local) return cb()

      const emails = [{ address: user.local.email, verified: false }]
      const password = user.local.password
      const lastName = user.surname
      const companyName = user.company_name
      const createdAt = user.signed_up

      const query = { _id: user._id }
      const update = {
        $set: { emails, password, companyName, lastName, createdAt },
        $unset: { local: '', company_name: '', surname: '', signed_up: '' }
      }

      db.users.update(query, update, cb)
    }, cb)
  })
}
