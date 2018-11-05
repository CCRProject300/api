const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const moment = require('moment-timezone')
const calories = require('kudoshealth-lib').calories
const storedStatsInterface = require('../lib/stored-stats-interface')

module.exports.get = ({ db }) => {
  const getStoredStats = storedStatsInterface(db)

  return {
    method: 'GET',
    path: '/stats',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)

      db.users.findOne({ _id: userId, deleted: false }, (err, user) => {
        if (err) return reply(err)
        if (!user) return reply(Boom.create(404, 'User not found'))

        const strategies = (user.methods || []).map((m) => m.strategy)

        Async.parallel({
          realTimeStats (cb) {
            getStats({ user, strategies }, cb)
          },
          cachedStats (cb) {
            getStoredStats(user, cb)
          }
        }, (err, stats) => {
          if (err) return reply(err)
          reply(Object.assign(stats.cachedStats, stats.realTimeStats))
        })
      })
    },
    config: {
      description: 'Get user stats',
      auth: 'auth0'
    }
  }

  function getStats ({ user, strategies }, cb) {
    const range = getUserGraphRangeUTC(user)
    const endDate = range.end

    Async.parallel({
      dailySum (cb) {
        calories.getTotal({ db, user, startDate: range.dayStart, endDate, strategies }, cb)
      },
      weeklySum (cb) {
        calories.getTotal({ db, user, startDate: range.weekStart, endDate, strategies }, cb)
      },
      monthlySum (cb) {
        calories.getTotal({ db, user, startDate: range.monthStart, endDate, strategies }, cb)
      },
      threeMonthlySum (cb) {
        calories.getTotal({ db, user, startDate: range.threeMonthStart, endDate, strategies }, cb)
      }
    }, cb)
  }
}

function getUserGraphRangeUTC (user) {
  const range = getGraphRangeUTC(user.timezone)
  const signUpDate = moment.utc(user.createdAt)
  if (signUpDate > range.threeMonthStart) {
    range.threeMonthStart = signUpDate
  }
  if (signUpDate > range.monthStart) {
    range.monthStart = signUpDate
  }
  if (signUpDate > range.weekStart) {
    range.weekStart = signUpDate
  }
  if (signUpDate > range.dayStart) {
    range.dayStart = signUpDate
  }
  Object.keys(range).forEach((date) => {
    range[date] = range[date].toDate()
  })
  return range
}

function getGraphRangeUTC () {
  const range = {}
  range.end = moment.utc().add(1, 'days').startOf('day')
  range.dayStart = moment.utc().startOf('day')
  range.weekStart = moment.utc().subtract(6, 'days').startOf('day')
  range.monthStart = moment.utc().subtract(30, 'days').startOf('day')
  range.threeMonthStart = moment.utc().subtract(90, 'days').startOf('day')
  return range
}
