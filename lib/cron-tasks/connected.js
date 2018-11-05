const async = require('async')
const frontendUrl = require('config').frontendUrl

module.exports = function ({ db, mailer }, cb) {
  db.users.find({'methods': {$exists: false}, 'emailPreferences.connected': true}, (err, users) => {
    if (err && cb) return cb(err)
    if (err) return console.error(err)

    if (!users && cb) return cb(new Error('no users found'))
    if (!users) return console.error('no users found')

    async.map(users, (user, sent) => {
      mailer.send('user-notify-no-device', user.emails[0].address, {user, frontendUrl}, sent)
    }, (err) => {
      if (err && cb) return cb(err)
      if (err) return console.error(err)

      const report = { users: users.length }
      if (cb) return cb(null, report)
    })
  })
}
