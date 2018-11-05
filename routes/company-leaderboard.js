const Joi = require('joi')
const moment = require('moment')
const MemberRankings = require('kudoshealth-lib').memberRankings
const createCompanyMemberPre = require('./prerequisites/company-member')

const timeframes = {
  monthly: 'months',
  weekly: 'weeks',
  daily: 'days'
}

module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/company/{companyId}/leaderboard',
    handler (request, reply) {
      const company = request.pre.company
      const sinceDate = moment.utc().subtract(1, timeframes[request.query.timeframe]).startOf('day').toDate()

      MemberRankings.get({ db, group: company, sinceDate }, (err, leaderboard) => {
        if (err) return reply(err)
        reply(leaderboard)
      })
    },
    config: {
      description: 'Get leaderboard for the given league',
      auth: 'auth0',
      validate: {
        params: {
          companyId: Joi.objectId().required()
        },
        query: {
          timeframe: Joi.string().valid(Object.keys(timeframes)).required()
        }
      },
      pre: [
        createCompanyMemberPre({ db })
      ]
    }
  }
}
