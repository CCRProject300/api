const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Async = require('async')
const Boom = require('boom')
const leagueReply = require('../lib/league-reply')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')
const addNewLeagueMemberNotifications = require('../lib/add-new-league-member-notifications')

module.exports.post = ({ db, mailer }) => ({
  method: 'POST',
  path: '/company/{companyId}/league',
  handler (request, reply) {
    const { name, description, startDate, endDate, teamSize, minTeamSize, categories, users } = request.payload
    const members = users ? Array.from(users) : []
    const company = request.pre.company

    Async.waterfall([
      function createPanels (cb) {
        Async.map(categories, (name, cb) => {
          db.panels.insert({ name, deleted: false }, (err, panel) => cb(err, panel))
        }, cb)
      },
      function getUsers (panels, cb) {
        db.users.find({ _id: { $in: members.map((u) => ObjectId(u)) } }, (err, users) => {
          cb(err, { users, panels })
        })
      },
      function createLeague ({ users, panels }, cb) {
        // Add company moderators as league moderators
        const moderators = (company.moderators || [])
          .filter((m) => m.active && m.activated)
          .map((m) => {
            const moderator = { user: m.user, active: true, activated: true }

            if (startDate) {
              moderator.startDate = startDate
            }

            return moderator
          })
        const members = users.map((u) => {
          let member = { user: u._id, active: true, activated: false }
          if (startDate) member.startDate = startDate
          return member
        })

        const leagueData = {
          name,
          teamSize,
          panel: panels.map((p) => ({ panelId: p._id })),
          leagueType: 'corporate',
          moderators,
          members: members,
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

        if (minTeamSize) {
          leagueData.minTeamSize = minTeamSize
        }

        db.leagues.insert(leagueData, (err, league) => cb(err, league))
      },
      function updateCompany (league, cb) {
        const query = { _id: company._id }
        const update = { $push: { leagues: { leagueId: league._id } } }

        db.companies.update(query, update, (err) => {
          if (err) return cb(err)
          cb(null, league)
        })
      },
      function addNotifications (league, cb) {
        addNewLeagueMemberNotifications({ db, mailer, league, userIds: members }, (err) => {
          if (err) return cb(err)
          cb(null, league)
        })
      }
    ], (err, league) => {
      if (err) return reply(err)
      leagueReply({ db, league }, (err, league) => {
        if (err) return reply(err)
        reply(league).code(201)
      })
    })
  },
  config: {
    description: 'Create a new company league',
    auth: 'auth0',
    validate: {
      payload: Joi.alternatives().try({
        name: Joi.string().required(),
        description: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        teamSize: Joi.number().valid(1).required(),
        users: Joi.array().items(Joi.objectId())
      }, {
        name: Joi.string().required(),
        description: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        teamSize: Joi.number().min(2).required(),
        minTeamSize: Joi.number().min(1).max(Joi.ref('teamSize')).required(),
        categories: Joi.array().items(Joi.string()),
        users: Joi.array().items(Joi.objectId())
      }, {
        name: Joi.string().required(),
        description: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        teamSize: Joi.valid(null).required(),
        minTeamSize: Joi.number().min(1).required(),
        categories: Joi.array().items(Joi.string()),
        users: Joi.array().items(Joi.objectId())
      }),
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/company/{companyId}/league/{leagueId}',
  handler (request, reply) {
    const company = request.pre.company
    const leagueId = ObjectId(request.params.leagueId)

    Async.waterfall([
      function getLeague (cb) {
        const query = { _id: leagueId }

        db.leagues.findOne(query, (err, league) => {
          if (err) return cb(err)
          if (!league) return cb(Boom.notFound('League not found'))
          cb(null, league)
        })
      },
      function removeLeagueFromCompany (league, cb) {
        const query = { _id: company._id }
        const update = { $pull: { leagues: { leagueId } } }

        db.companies.update(query, update, (err) => cb(err, league))
      },
      function removeLeague (league, cb) {
        const query = { _id: league._id }
        const update = { $set: { deleted: true } }

        db.leagues.update(query, update, (err) => cb(err, league))
      },
      function removeOutstandingNotifications (league, cb) {
        db.notifications.update({
          'group._id': leagueId,
          deleted: false,
          redeemedAt: null
        }, { $set: { deleted: true } }, { multi: true }, (err) => {
          if (err) return cb(err)
          cb(null, league)
        })
      },
      function getPanels (league, cb) {
        const panelIds = (league.panel || []).map((p) => p.panelId)
        const query = { _id: { $in: panelIds } }

        db.panels.find(query, { _id: 1, team: 1 }, (err, panels) => cb(err, panels))
      },
      function removePanels (panels, cb) {
        if (!panels.length) return cb(null, panels)

        const query = { _id: { $in: panels.map((p) => p._id) } }
        const update = { $set: { deleted: true } }

        db.panels.update(query, update, { multi: true }, (err) => cb(err, panels))
      },
      function getTeams (panels, cb) {
        if (!panels.length) return cb(null, [])

        const teamIds = panels.reduce((ids, panel) => {
          return ids.concat((panel.team || []).map((t) => t.teamId))
        }, [])

        const query = { _id: { $in: teamIds } }

        db.teams.find(query, { _id: 1 }, (err, teams) => cb(err, teams))
      },
      function removeTeams (teams, cb) {
        if (!teams.length) return cb()

        const query = { _id: { $in: teams.map((t) => t._id) } }
        const update = { $set: { deleted: true } }

        db.teams.update(query, update, { multi: true }, (err) => cb(err))
      }
    ], (err) => {
      if (err) return reply(err)
      reply().code(204)
    })
  },
  config: {
    description: 'Delete a company league',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        leagueId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})
