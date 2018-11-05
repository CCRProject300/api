const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const createLeagueModeratorPre = require('./prerequisites/league-moderator')

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/league/{leagueId}/member/{userId}',
  handler (request, reply) {
    const userId = ObjectId(request.params.userId)
    const league = request.pre.league
    const update = { $pull: { members: { user: userId } } }

    Async.waterfall([
      function removeFromLeague (cb) {
        const query = { _id: league._id }
        db.leagues.update(query, update, (err) => cb(err))
      },
      function removeOutstandingNotifications (cb) {
        db.notifications.update({
          'user._id': userId,
          'group._id': league._id,
          deleted: false,
          redeemedAt: null
        }, { $set: { deleted: true } }, { multi: true }, (err) => {
          if (err) return cb(err)
          cb()
        })
      },
      function getPanels (cb) {
        const panelIds = (league.panel || []).map((p) => p.panelId)
        const query = { _id: { $in: panelIds } }

        db.panels.find(query, { _id: 1, team: 1 }, (err, panels) => cb(err, panels))
      },
      function removeFromPanels (panels, cb) {
        if (!panels.length) return cb(null, panels)
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
    description: 'Remove a member from a league',
    auth: 'auth0',
    validate: {
      params: {
        leagueId: Joi.objectId().required(),
        userId: Joi.objectId().required()
      }
    },
    pre: [
      createLeagueModeratorPre({ db })
    ]
  }
})
