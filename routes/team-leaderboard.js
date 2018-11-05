const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Boom = require('boom')
const Async = require('async')
const MemberRankings = require('kudoshealth-lib').memberRankings
const teamStartDate = require('kudoshealth-lib').teamStartDate
const teamDataHelpers = require('../lib/team-data-helpers')

module.exports.get = ({ db }) => {
  const { getTeamLeague, isLeagueMember } = teamDataHelpers(db)

  return {
    method: 'GET',
    path: '/team/{teamId}/leaderboard',
    handler (request, reply) {
      const teamId = ObjectId(request.params.teamId)
      const userId = ObjectId(request.auth.credentials)

      Async.waterfall([
        function getLeague (cb) {
          getTeamLeague(teamId, (err, league) => {
            if (err) return cb(err)
            if (!league) return cb(Boom.notFound('League not found'))
            cb(null, league)
          })
        },
        function ensureLeagueMember (league, cb) {
          isLeagueMember({ league, userId }, (err, isMember) => cb(err, isMember, league))
        },
        function getTeam (isMember, league, cb) {
          if (!isMember) return cb(Boom.forbidden('Not a member of this league'))
          db.teams.findOne({ _id: teamId }, (err, team) => cb(err, { team, league }))
        },
        function getLeaderboard ({ team, league }, cb) {
          MemberRankings.get({ db, group: team, sinceDate: teamStartDate({ team, league }) }, cb)
        }
      ], (err, leaderboard) => {
        if (err) return reply(err)
        reply(leaderboard)
      })
    },
    config: {
      description: 'Get leaderboard for the given team',
      auth: 'auth0',
      validate: {
        params: {
          teamId: Joi.objectId().required()
        }
      }
    }
  }
}
