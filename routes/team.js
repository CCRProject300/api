const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Boom = require('boom')
const Async = require('async')
const teamReply = require('../lib/team-reply')
const teamDataHelpers = require('../lib/team-data-helpers')

module.exports.get = ({ db }) => {
  const { getTeamLeague, isLeagueMember } = teamDataHelpers(db)

  return {
    method: 'GET',
    path: '/team/{teamId}',
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
          db.teams.findOne({ _id: teamId }, (err, team) => cb(err, team, league))
        }
      ], (err, team, league) => {
        if (err) return reply(err)
        reply(teamReply(team, league, userId))
      })
    },
    config: {
      description: 'Get team info',
      auth: 'auth0',
      validate: {
        params: {
          teamId: Joi.objectId().required()
        }
      }
    }
  }
}

module.exports.patch = ({ db }) => {
  return {
    method: 'PATCH',
    path: '/team/{teamId}',
    handler (request, reply) {
      const teamId = ObjectId(request.params.teamId)
      const userId = ObjectId(request.auth.credentials)
      const data = request.payload

      Async.waterfall([
        function findTeam (cb) {
          db.teams.findOne({ _id: teamId, deleted: false }, (err, team) => {
            if (err) return cb(err)
            if (!team) return cb(Boom.notFound('Team not found'))
            cb(null, team)
          })
        },
        function confirmUserIsInTeamAndUpdate (team, cb) {
          if (!team.members.some((m) => m.user.equals(userId))) return cb(Boom.forbidden('User is not a member of this team'))

          db.teams.findAndModify({
            query: { _id: teamId },
            update: { $set: data },
            new: true
          }, cb)
        }
      ], (err, team) => {
        if (err) return reply(err)
        reply(teamReply(team, null, userId))
      })
    },
    config: {
      description: 'Update team details',
      validate: {
        payload: {
          name: Joi.string().min(1).required()
        },
        params: {
          teamId: Joi.objectId().required()
        }
      },
      auth: 'auth0'
    }
  }
}
