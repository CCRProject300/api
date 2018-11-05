const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
const Boom = require('boom')
const Async = require('async')
Joi.objectId = require('joi-objectid')(Joi)
const moment = require('moment')
const leagueReply = require('../lib/league-reply')
const teamReply = require('../lib/team-reply')
const createLeagueMemberPre = require('./prerequisites/league-member')
const createLeagueModeratorPre = require('./prerequisites/league-moderator')
const Actions = require('../lib/actions')

module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/league/{leagueId}',
    handler (request, reply) {
      db.companies.findOne({ 'leagues.leagueId': request.pre.league._id }, { _id: 1, name: 1 }, (err, company) => {
        if (err) return reply(err)

        const userId = ObjectId(request.auth.credentials)
        const league = Object.assign(request.pre.league, { company })

        leagueReply({ db, league, userId }, (err, league) => {
          if (err) return reply(err)
          reply(league)
        })
      })
    },
    config: {
      description: 'Get league info',
      auth: 'auth0',
      validate: {
        params: {
          leagueId: Joi.objectId().required()
        }
      },
      pre: [
        createLeagueMemberPre({ db })
      ]
    }
  }
}

module.exports.post = ({ db }) => ({
  method: 'POST',
  path: '/league',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const { name, description, startDate, endDate } = request.payload

    const leagueData = {
      name,
      teamSize: 1,
      leagueType: 'private',
      moderators: [{ user: userId, active: true, activated: true }],
      members: [],
      deleted: false
    }

    if (description) {
      leagueData.description = description
    }

    if (startDate) {
      leagueData.moderators[0].startDate = leagueData.startDate = startDate
    }

    if (endDate) {
      leagueData.endDate = endDate
    }

    db.leagues.insert(leagueData, (err, league) => {
      if (err) return reply(err)
      leagueReply({ db, league, userId }, (err, league) => {
        if (err) return reply(err)
        reply(league).code(201)
      })
    })
  },
  config: {
    description: 'Create a new league',
    auth: 'auth0',
    validate: {
      payload: {
        name: Joi.string().required(),
        description: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate'))
      }
    }
  }
})

module.exports.join = ({ db }) => {
  const actions = Actions(db)

  return {
    method: 'POST',
    path: '/league/{leagueId}/join',
    handler (request, reply) {
      const userId = ObjectId(request.auth.credentials)
      const leagueId = ObjectId(request.params.leagueId)
      const panelId = request.payload && request.payload.panelId && ObjectId(request.payload.panelId)

      Async.waterfall([
        function getLeague (cb) {
          db.leagues.findOne({ _id: leagueId, deleted: false }, cb)
        },
        function getCompany (league, cb) {
          if (!league) return reply(Boom.notFound('Cannot find league'))

          db.companies.findOne({ 'leagues.leagueId': leagueId }, (err, company) => cb(err, { company, league }))
        },
        function checkCompany ({ company, league }, cb) {
          // If this isn't a company league, let the user join
          if (!company) return cb(null, league)

          // Otherwise, they need to be a member/moderator of the company
          const { moderators, members } = company
          const isUser = (m) => m.user.equals(userId)
          if (!(moderators.some(isUser) || members.some(isUser))) {
            return cb(Boom.forbidden('User is not a member of the associated company'))
          }
          cb(null, league)
        },
        function joinLeague (league, cb) {
          if (league.teamSize === 1) return actions.joinIndividualLeague({ userId, leagueId, confirm: true }, (err) => cb(err, league))
          actions.joinGroupLeague({ userId, leagueId, panelId, confirm: true }, (err) => cb(err, league))
        },
        function redeemNotifications (league, cb) {
          db.notifications.update({
            'user._id': userId,
            'group._id': league._id,
            type: { $in: ['groupLeagueInvite', 'indLeagueInvite'] },
            deleted: false,
            redeemedAt: null
          }, { $set: { redeemedAt: moment.utc().toDate() } }, (err) => cb(err, league))
        }
      ], (err, league) => {
        if (err) return reply(err)
        leagueReply({ db, league, userId }, (err, league) => {
          if (err) return reply(err)
          reply(league)
        })
      })
    },
    config: {
      description: 'Join a company league',
      auth: 'auth0',
      validate: {
        payload: Joi.object({
          panelId: Joi.objectId()
        }).allow(null),
        params: {
          leagueId: Joi.objectId().required()
        }
      }
    }
  }
}

module.exports.switch = ({ db }) => ({
  method: 'POST',
  path: '/league/{leagueId}/switch',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const leagueId = ObjectId(request.params.leagueId)
    const teamId = request.payload && request.payload.teamId && ObjectId(request.payload.teamId)
    const panelId = request.payload && request.payload.panelId && ObjectId(request.payload.panelId)

    Async.waterfall([
      function getLeague (cb) {
        db.leagues.findOne({ _id: leagueId, 'members.user': userId, deleted: false }, cb)
      },

      function getOtherDetails (league, cb) {
        if (!league) return reply(Boom.notFound('Cannot find league or user is not a member'))
        if (league.leagueType === 'public') return reply(Boom.forbidden('A user cannot switch teams in a public league'))

        let dataFuncs = {
          companyCount: (done) => db.companies.count({ 'leagues.leagueId': leagueId, 'members.user': userId, deleted: false }, done)
        }
        if (teamId) {
          dataFuncs.newTeam = (done) => db.teams.findOne({ _id: teamId, deleted: false }, done)
        }
        if (panelId) {
          dataFuncs.newPanel = (done) => db.panels.findOne({ _id: panelId, deleted: false }, done)
        }

        Async.parallel(dataFuncs, (err, data) => cb(err, Object.assign({ league }, data)))
      },

      function getPanels (data, cb) {
        const { companyCount, league, newTeam, newPanel } = data
        if (!companyCount) return reply(Boom.notFound('Cannot find company, or user is not a member'))
        if ('newPanel' in data && !newPanel) return reply(Boom.notFound('Cannot find panel user has requested to join'))
        if ('newTeam' in data) {
          if (!newTeam) return reply(Boom.notFound('Cannot find new team'))
          if (newTeam.members.length === league.teamSize) return reply(Boom.conflict('That team is already full'))
        }

        db.panels.find({ _id: { $in: league.panel.map((p) => p.panelId) }, deleted: false }, (err, panels) => cb(err, { league, panels, newPanel, newTeam }))
      },

      function getTeams ({ league, panels, newPanel, newTeam }, cb) {
        if (newTeam) {
          newPanel = panels.find((p) => p.team.some((t) => t.teamId.equals(newTeam._id)))
        }

        const teamIds = panels.reduce((ids, panel) => {
          ids = ids.concat(panel.team ? panel.team.map((t) => t.teamId) : [])
          return ids
        }, [])
        db.teams.find({ _id: { $in: teamIds } }, (err, teams) => cb(err, { league, panels, newPanel, teams, newTeam }))
      },

      function leaveTeamAndPanel ({ league, panels, newPanel, teams, newTeam }, cb) {
        const userTeam = teams.find((t) => t.members.some((m) => m.user.equals(userId)))
        if (!userTeam) return cb(Boom.notFound('User is not a member of a team in this league'))

        let panelUpdate = { $pull: { members: { user: userId } } }
        let teamUpdateFunc = (done) => db.teams.update({ _id: userTeam._id }, { $pull: { members: { user: userId } }, $inc: { memberCount: -1 } }, done)

        if (userTeam.members.length === 1) {
          panelUpdate.$pull.team = { teamId: userTeam._id }
          teamUpdateFunc = (done) => db.teams.remove({ _id: userTeam._id }, done)
        }

        Async.parallel([
          (done) => db.panels.update({ _id: { $in: panels.map((p) => p._id) }, 'members.user': userId }, panelUpdate, done),
          teamUpdateFunc
        ], (err) => cb(err, { league, newPanel, newTeam }))
      },

      function joinOrCreateTeam ({ league, newPanel, newTeam }, cb) {
        const member = {
          user: userId,
          startDate: new Date(),
          _id: ObjectId(),
          activated: true,
          active: true
        }

        if (newTeam) {
          return Async.parallel({
            team: (done) => db.teams.findAndModify({
              query: { _id: newTeam._id },
              update: { $push: { members: member }, $inc: { memberCount: 1 } },
              new: true
            }, done),
            panel: (done) => db.panels.update({ _id: newPanel._id }, { $push: { members: member } }, done)
          }, (err, res) => {
            if (err) return cb(err)
            return cb(null, { team: res.team[0], league })
          })
        }

        Async.waterfall([
          function countTeams (done) {
            const teamIds = (newPanel.team || []).map((t) => t.teamId)

            // No existing teams!
            if (!teamIds.length) {
              return done(null, 0)
            }

            const query = { deleted: false, _id: { $in: teamIds } }
            db.teams.count(query, done)
          },
          function makeNewTeam (teamCount, done) {
            db.teams.insert({
              name: `Team ${teamCount + 1} - ${newPanel.name}`,
              startDate: league.startDate,
              endDate: league.endDate,
              moderators: league.moderators,
              members: [member],
              memberCount: 1,
              panel: {
                _id: newPanel._id,
                name: newPanel.name
              },
              deleted: false
            }, done)
          },
          function updatePanel (newTeam, done) {
            const query = { _id: newPanel._id }
            const update = { $push: { team: { teamId: newTeam._id }, members: member } }
            db.panels.update(query, update, (err) => done(err, newTeam))
          }
        ], (err, team) => cb(err, { league, team }))
      }
    ], (err, data) => {
      if (err) return reply(err)
      reply(teamReply(data.team, data.league, userId))
    })
  },
  config: {
    description: 'Switch teams within a company league',
    auth: 'auth0',
    validate: {
      payload: Joi.alternatives(
        Joi.object({
          panelId: Joi.objectId().required()
        }),
        Joi.object({
          teamId: Joi.objectId().required()
        })
      ),
      params: {
        leagueId: Joi.objectId().required()
      }
    }
  }
})

module.exports.public = ({ db }) => ({
  method: 'GET',
  path: '/league/{leagueId}/public',
  handler (request, reply) {
    const _id = ObjectId(request.params.leagueId)
    const fields = {
      name: 1,
      startDate: 1,
      endDate: 1,
      description: 1,
      branding: 1
    }
    db.leagues.findOne({ _id, deleted: false }, fields, (err, league) => {
      if (err) return reply(Boom.wrap(err))
      return reply(league)
    })
  },
  config: {
    description: 'Get a public league',
    validate: {
      params: {
        leagueId: Joi.objectId().required()
      }
    }
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/league/{leagueId}',
  handler (request, reply) {
    const leagueId = ObjectId(request.params.leagueId)
    const query = { _id: leagueId }
    const update = { $set: { deleted: true } }

    db.leagues.update(query, update, (err) => {
      if (err) return reply(err)
      db.notifications.update({
        'group._id': leagueId,
        deleted: false,
        redeemedAt: null
      }, { $set: { deleted: true } }, { multi: true }, (err) => {
        if (err) return reply(err)
        reply().code(204)
      })
    })
  },
  config: {
    description: 'Delete a league',
    auth: 'auth0',
    validate: {
      params: {
        leagueId: Joi.objectId().required()
      }
    },
    pre: [
      createLeagueModeratorPre({ db })
    ]
  }
})
