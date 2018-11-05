const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/company/{companyId}/member/{userId}',
  handler (request, reply) {
    const userId = ObjectId(request.params.userId)
    const company = request.pre.company
    const update = { $pull: { members: { user: userId } } }

    Async.waterfall([
      function removeFromCompany (cb) {
        const query = { _id: company._id }
        db.companies.update(query, update, (err) => cb(err))
      },
      function removeOutstandingNotifications (cb) {
        db.notifications.update({
          'user._id': userId,
          'group._id': company._id,
          deleted: false,
          redeemedAt: null
        }, { $set: { deleted: true } }, { multi: true }, (err) => {
          if (err) return cb(err)
          cb()
        })
      },
      function getLeagues (cb) {
        const leagueIds = (company.leagues || []).map((l) => l.leagueId)
        const query = { _id: { $in: leagueIds } }
        db.leagues.find(query, { _id: 1, panel: 1 }, (err, leagues) => cb(err, leagues))
      },
      function removeFromLeagues (leagues, cb) {
        if (!leagues.length) return cb(null, [])
        const query = { _id: { $in: leagues.map((l) => l._id) } }
        db.leagues.update(query, update, { multi: true }, (err) => cb(err, leagues))
      },
      function getPanels (leagues, cb) {
        if (!leagues.length) return cb(null, [])

        const panelIds = leagues.reduce((ids, league) => {
          return ids.concat((league.panel || []).map((p) => p.panelId))
        }, [])

        const query = { _id: { $in: panelIds } }

        db.panels.find(query, { _id: 1, team: 1 }, (err, panels) => cb(err, panels))
      },
      function removeFromPanels (panels, cb) {
        if (!panels.length) return cb(null, [])
        const query = { _id: { $in: panels.map((p) => p._id) } }
        db.panels.update(query, update, { multi: true }, (err) => cb(err, panels))
      },
      function removeFromTeams (panels, cb) {
        if (!panels.length) return cb()

        const teamIds = panels.reduce((ids, panel) => {
          return ids.concat((panel.team || []).map((t) => t.teamId))
        }, [])

        const query = { _id: { $in: teamIds } }

        db.teams.update(query, update, { multi: true }, (err) => cb(err))
      }
    ], (err) => {
      if (err) return reply(err)
      reply().code(204)
    })
  },
  config: {
    description: 'Remove a member',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        userId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})
