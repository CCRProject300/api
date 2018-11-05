const async = require('async')
const config = require('config')

module.exports.emails = function ({ db, mailer }, cb) {
  async.waterfall([
    (cb) => {
      db.users.find({
        deleted: false,
        'emailPreferences.connected': true,
        $or: [{weight: null}, {height: null}, {gender: null}, {dob: null}]
      }, cb)
    },
    (users, cb) => {
      async.map(users, (user, done) => {
        const tplData = {
          name: user.firstName,
          missingStats: ['height', 'weight', 'dob', 'gender'].filter((field) => !user[field]),
          frontendUrl: config.frontendUrl
        }
        mailer.send('user-notify-missing-stats', user.emails[0].address, tplData, (err) => {
          if (err) return done(err, {sucess: 0, fail: 1})
          done(null, {sucess: 1, fail: 0})
        })
      }, cb)
    },
    (reports, cb) => {
      const report = reports.reduce((report, email) => {
        report.success += email.sucess
        report.fail += email.fail
        return report
      }, {success: 0, fail: 0})
      cb(null, report)
    }
  ], (err, report) => {
    if (err && cb) return cb(err)
    if (err) return console.error(err)
    if (cb) return cb(null, report)
    return report
  })
}

module.exports.notifications = function ({ db, mailer }, cb) {
  db.users.find({
    deleted: false,
    $or: [
      { weight: null },
      { height: null },
      { dob: null },
      { gender: null }
    ]
  }, (err, users) => {
    if (err && cb) return cb(err)
    if (err) return console.error(err)

    const notification = {
      type: 'missingStats',
      messages: ['Some of your personal details are missing, and you can\'t score Kudos points without them. Do you want to update them now?'],
      url: '/settings',
      deleted: false
    }
    const userCount = users.length

    const insertNotifications = function (users, done) {
      const bulk = db.notifications.initializeUnorderedBulkOp()
      const theseUsers = users.splice(0, 1000)
      theseUsers.forEach((user) => {
        bulk.find({ 'user._id': user._id, type: 'missingStats' }).upsert().replaceOne(Object.assign({ user: { _id: user._id } }, notification))
      })
      bulk.execute((err) => {
        if (err) return done(err)

        if (users.length) return insertNotifications(users, done)
        done()
      })
    }
    insertNotifications(users, (err) => {
      if (err && cb) return cb(err)
      if (err) return console.error(err)

      const report = { users: userCount }
      if (cb) return cb(null, report)
    })
  })
}
