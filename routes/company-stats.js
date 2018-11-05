const moment = require('moment-timezone')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')
const storedStatsCorpInterface = require('../lib/stored-stats-corp-interface')

module.exports.get = ({ db }) => {
  const getCorpStats = storedStatsCorpInterface(db)

  return {
    method: 'GET',
    path: '/company/{companyId}/stats',
    handler (request, reply) {
      const company = request.pre.company

      const now = moment.utc()
      const sevenDaysAgo = moment.utc().subtract(7, 'days')

      const stats = {
        pctActiveEmployees: getActiveEmployeesPercent(company),
        numberNewMembersInLastWeek: findStartedBetween(company, sevenDaysAgo, now)
      }

      stats.percentageChange = findPercentageChange(
        stats.numberNewMembersInLastWeek,
        findStartedBetween(company, moment.utc().subtract(14, 'days'), sevenDaysAgo)
      )

      getCorpStats(company, (err, data) => {
        if (err) return reply(err)

        Object.assign(stats, data)
        reply(stats)
      })
    },
    config: {
      description: 'Get company stats',
      auth: 'auth0',
      pre: [
        createCompanyModeratorPre({ db })
      ]
    }
  }
}

function getActiveEmployeesPercent (company) {
  if (company.numberEmployees && company.members.length > 0) {
    return round1dp(company.members.length * 100 / company.numberEmployees)
  }
  return 0
}

function findPercentageChange (lastWk, previousWk) {
  if (previousWk === 0) {
    return 0
  } else if (lastWk === 0) {
    return 0
  } else if (lastWk > previousWk) {
    return round1dp((lastWk * 100 / previousWk) - 100)
  } else {
    return 1 - round1dp((lastWk * 100 / previousWk) - 100)
  }
}

function findStartedBetween (company, cutoffStart, cutoffEnd) {
  var numMembers = company.members.filter(function (item) {
    return (item.startDate > cutoffStart && item.startDate < cutoffEnd)
  }).length
  return numMembers
}

function round1dp (num) {
  return Math.round(num * 10) / 10
}
