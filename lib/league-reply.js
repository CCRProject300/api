const Async = require('async')
const pick = require('lodash.pick')
const { hasRole } = require('./roles')

module.exports = ({ db, league, userId }, cb) => {
  Async.waterfall([
    function getUserAndCompany (done) {
      let payload = pick(league, [
        'name',
        'teamSize',
        'minTeamSize',
        'description',
        'startDate',
        'endDate',
        'leagueType',
        'company',
        'branding'
      ])
      payload._id = league._id.toString()
      payload.memberCount = league.members.length

      if (!userId) return done(null, {}, payload)
      Async.parallel({
        user: (cb) => db.users.findOne({ _id: userId }, cb),
        companyCount: (cb) => db.companies.count({ 'moderators.user': userId, 'leagues.leagueId': league._id }, cb)
      }, (err, data) => done(err, data, payload))
    },
    function markMemberModerator ({ user, companyCount }, payload, done) {
      if (!userId) return done(null, null, payload)

      if ((league.members || []).some((m) => m.user.equals(userId))) {
        payload.member = true
      }

      if ((league.moderators || []).some((m) => m.user.equals(userId))) {
        payload.moderator = true
      }

      if (league.leagueType === 'public' && hasRole(user, 'admin')) {
        payload.moderator = true
      }

      if (companyCount) {
        payload.moderator = true
      }

      if (!league.panel) return done(null, null, payload)

      db.panels.find({
        _id: { $in: league.panel.map((p) => p.panelId) }
      }, {
        _id: 1, name: 1
      }, (err, panels) => done(err, panels, payload))
    },
    function denormalisePanels (panels, payload, done) {
      if (panels) payload.panels = panels
      done(null, payload)
    }
  ], (err, payload) => {
    if (err) return cb(err)
    cb(null, payload)
  })
}
