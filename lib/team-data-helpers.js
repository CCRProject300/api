const Async = require('async')
const { hasRole } = require('./roles')

module.exports = (db) => {
  function getTeamLeague (teamId, cb) {
    const query = { 'team.teamId': teamId, deleted: false }

    db.panels.findOne(query, (err, panel) => {
      if (err) return cb(err)
      if (!panel) return cb()

      const query = { 'panel.panelId': panel._id, deleted: false }

      db.leagues.findOne(query, (err, league) => cb(err, league))
    })
  }

  function isLeagueMember ({ league, userId }, cb) {
    Async.parallel({
      companyCount: (done) => db.companies.count({ 'leagues.leagueId': league._id, 'moderators.user': userId }, done),
      user: (done) => db.users.findOne({ _id: userId }, { roles: 1 }, done)
    }, (err, { companyCount, user }) => {
      if (err) return cb(err)

      if (isLeagueModerator(league, user, companyCount)) return cb(null, true)
      if (league.members.some((m) => m.user.equals(user._id))) return cb(null, true)

      cb(null, false)
    })
  }

  function isLeagueModerator (league, user, companyCount) {
    // this is a public league and the user is an admin
    if (league.leagueType === 'public' && hasRole(user, 'admin')) return true

    // user is a moderator of the company that owns this league
    if (companyCount) return true

    // user is a member or moderator of this league
    if (league.moderators.some((m) => m.user.equals(user._id))) return true

    return false
  }

  return {
    getTeamLeague,
    isLeagueMember,
    isLeagueModerator
  }
}
