const moment = require('moment')
const Async = require('async')
const pick = require('lodash.pick')
const calories = require('kudoshealth-lib').calories
const getAverageKudosCoins = require('./average-weekly-coins')

const ageBrackets = [
  '16-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+'
]

const genders = [ 'Male', 'Female', 'Other' ]

module.exports = function (db) {
  return (company, cb) => {
    Async.parallel({
      averagePointsLastWeek: getAveragePointsLastWeek.bind(null, company),
      averageKudosCoins: getAverageKudosCoins.bind(null, db, company),
      standings: getCompanyStats.bind(null, company),
      leaderboard: getCompanyLeaderboards.bind(null, company),
      kudosPoints: getKudosPoints.bind(null, company),
      ranking: getGlobalStats.bind(null, company)
    }, cb)
  }

  function getAveragePointsLastWeek (company, cb) {
    const now = moment.utc()
    const sevenDaysAgo = moment.utc().subtract(7, 'days')

    Async.waterfall([
      function getEmployees (cb) {
        const query = { _id: { $in: (company.members || []).map((m) => m.user) } }
        const fields = { methods: 1 }
        db.users.find(query, fields, (err, employees) => cb(err, employees))
      },
      function getAveragePointsLastWeek (employees, cb) {
        if (!employees.length) {
          return cb(null, 0)
        }

        Async.reduce(employees, 0, (total, employee, cb) => {
          const startDate = sevenDaysAgo.toDate()
          const endDate = now.toDate()
          const strategies = (employee.methods || []).map((m) => m.strategy)

          calories.getTotal({ db, user: employee, startDate, endDate, strategies }, (err, t) => {
            if (err) return cb(err)
            cb(null, total + t)
          })
        }, (err, total) => {
          if (err) return cb(err)
          cb(null, Math.round((total / employees.length) * 10) / 10)
        })
      }
    ], cb)
  }

  function getCompanyStats (company, cb) {
    const today = moment.utc().startOf('day').toDate()

    db.dailyStats.find({ date: today, companyId: { $in: [ company._id, 'ALL' ] } }, (err, statsDocs) => {
      if (err) return cb(err)
      if (!statsDocs.length) return cb(null, null)

      let standings = {}
      addStats(standings, statsDocs, { key: 'company', name: company.name, companyId: company._id })
      addStats(standings, statsDocs, { key: 'community', name: 'Kudos Community', companyId: 'ALL' })

      cb(null, standings)
    })
  }

  function getCompanyLeaderboards (company, cb) {
    const today = moment.utc().startOf('day').toDate()

    db.dailyStats.findOne({ date: today, companyId: company._id, type: 'companyLeaderboard' }, (err, res) => {
      if (err) return cb(err)

      cb(null, res && res.leaderboard)
    })
  }

  function getKudosPoints (company, cb) {
    const monthStarts = Array(12).fill(0).map((_, ind) => {
      return moment.utc().subtract(ind, 'months').startOf('month').valueOf()
    }).reverse()

    db.dailyStats.find({ type: 'monthlyCompanyAverage', companyId: company._id, monthStart: { $in: monthStarts } }, (err, stats) => {
      if (err) return cb(err)

      cb(null, {
        labels: monthStarts.map((s) => moment.utc(s).format('MMM')),
        legend: {
          'x-axis': 'Monthly Average KudosPoints',
          'y-axis': 'KudosPoints'
        },
        series: [
          monthStarts.map((m) => {
            const stat = stats.find((s) => s.monthStart === m)
            return stat ? stat.kudosPoints : 0
          })
        ]
      })
    })
  }

  function getGlobalStats (company, cb) {
    const monthStart = moment.utc().startOf('month').valueOf()
    db.dailyStats.findOne({ type: 'globalStats', companyId: company._id, monthStart }, (err, res) => {
      if (err) return cb(err)

      cb(null, res && pick(res, ['globalRanking', 'activeUsers', 'monthlySum', 'monthlyDiff']))
    })
  }
}

function addStats (standings, statsDocs, { key, name, companyId }) {
  let data = {}
  statsDocs = statsDocs.filter((d) => idMatch(companyId, d.companyId))

  const total = statsDocs.find((d) => d.dem === 'all')
  data.monthlyAverage = total ? total.kudosPoints : 0

  const age = ageBrackets.reduce((ageObj, bracket) => {
    const stat = statsDocs.find((d) => d.dem === bracket)
    ageObj[bracket] = stat ? stat.kudosPoints : 0
    return ageObj
  }, {})
  data.age = age

  const gender = genders.reduce((genderObj, bracket) => {
    const stat = statsDocs.find((d) => d.dem === bracket)
    genderObj[bracket] = stat ? stat.kudosPoints : 0
    return genderObj
  }, {})
  data.gender = gender

  standings[key] = { name, data }
}

function idMatch (idA, idB) {
  idA = idA.toString()
  idB = idB.toString()
  return idA === idB
}
