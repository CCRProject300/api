const Async = require('async')
const moment = require('moment')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const createCompanyMemberPre = require('./prerequisites/company-member')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')
const MemberRankings = require('kudoshealth-lib').memberRankings
const leagueReply = require('../lib/league-reply')

const timeframes = {
  daily: 'days',
  weekly: 'weeks',
  monthly: 'months'
}

module.exports.getLeagues = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/leagues',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const company = request.pre.company

    const leagueIds = (company.leagues || []).map((c) => c.leagueId)

    if (!leagueIds.length) return reply([])

    const query = {
      _id: { $in: leagueIds },
      deleted: false
    }
    const sort = { endDate: -1 }

    db.leagues.find(query).sort(sort, (err, leagues) => {
      if (err) return reply(err)
      Async.map(leagues, (l, cb) => {
        leagueReply({ db, league: l, userId }, cb)
      }, (err, leagues) => {
        if (err) return reply(err)
        reply(leagues)
      })
    })
  },
  config: {
    description: 'Get all leagues for a company',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyMemberPre({ db })
    ]
  }
})

module.exports.getLeaguesLeaderboard = ({ db, cachedCalc }) => {
  return {
    method: 'GET',
    path: '/company/{companyId}/leagues-leaderboard',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)
      const company = request.pre.company
      const leagueIds = (company.leagues || []).map((c) => c.leagueId)

      if (!leagueIds.length) return reply([])

      const endDate = moment.utc().toDate()
      const startDate = moment.utc().subtract(1, timeframes[request.query.timeframe]).toDate()
      const query = {
        _id: { $in: leagueIds },
        moderators: { $elemMatch: { user: userId, activated: true, active: true } },
        deleted: false
      }

      cachedCalc({ groupId: request.params.companyId, startDate, endDate, query }, calcLeagueStats, (err, stats) => {
        if (err) return reply(err)
        reply(stats)
      })
    },
    config: {
      description: 'Get leaderboard of all leagues for a company',
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
        createCompanyModeratorPre({ db })
      ]
    }
  }

  function calcLeagueStats ({ groupId, startDate, endDate, query }, cb) {
    Async.waterfall([
      function getLeagues (cb) {
        db.leagues.find(query, {
          name: 1,
          members: 1,
          startDate: 1,
          endDate: 1,
          teamSize: 1
        }, cb)
      },
      function getLeagueRankings (leagues, cb) {
        Async.map(leagues, (league, done) => {
          MemberRankings.get({ db, group: league, sinceDate: startDate }, (err, rankings) => {
            if (err) return done(err)
            done(null, { league, rankings })
          })
        }, cb)
      }
    ], (err, leagueObjs) => {
      if (err) return cb(err)
      const stats = leagueObjs.map((leagueObj) => {
        const leagueSize = leagueObj.rankings.length
        const leagueTotal = leagueObj.rankings.reduce((sum, ranking) => sum + ranking.score, 0)
        return Object.assign({}, leagueObj.league, { score: leagueTotal / leagueSize })
      }).sort((a, b) => b.score - a.score)
      cb(null, stats)
    })
  }
}
