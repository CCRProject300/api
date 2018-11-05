const cron = require('node-cron')
const tasks = require('./cron-tasks')
const config = require('config').cron

module.exports = function ({ db, mailer }) {
  return {
    start: function () {
      console.log(`node-cron ${Object.keys(tasks).length} tasks started at: ${new Date()}`)
      cron.schedule(config.weekly, tasks.connected.bind(null, { db, mailer }), true)
      cron.schedule(config.alternateWeekDays, tasks.missingStats.emails.bind(null, { db, mailer }), true)
      cron.schedule(config.daily, tasks.missingStats.notifications.bind(null, { db, mailer }), true)
      cron.schedule(config.daily, tasks.leaderboard.bind(null, { db, mailer }), true)
      cron.schedule(config.weekly, tasks.podium.bind(null, { db, mailer }), true)
      cron.schedule(config.monthly, tasks.monthlyStats.bind(null, { db, mailer }), true)
      cron.schedule(config.daily, tasks.purchasesNotification.bind(null, { db, mailer }), true)
    }
  }
}
