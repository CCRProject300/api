const Async = require('async')
const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')
const teamDataHelpers = require('../../lib/team-data-helpers')

// Restrict route to users who are moderators of a given league
// Requires {leagueId} path param and config.auth = 'auth0' to be set on the route
module.exports = ({ db, leagueIdParam = 'leagueId', assign = 'league', failAction = 'error' }) => {
  const { isLeagueModerator } = teamDataHelpers(db)

  return {
    method (request, reply) {
      const userId = ObjectId(request.auth.credentials)
      const leagueId = ObjectId(request.params[leagueIdParam])

      Async.parallel({
        league: (cb) => db.leagues.findOne({ _id: leagueId, deleted: false }, cb),
        user: (cb) => db.users.findOne({ _id: userId }, { roles: 1 }, cb),
        companyCount: (cb) => db.companies.count({ 'moderators.user': userId, 'leagues.leagueId': leagueId }, cb)
      }, (err, { league, user, companyCount }) => {
        if (err) return reply(err)
        if (!league) return reply(Boom.notFound())

        if (isLeagueModerator(league, user, companyCount)) return reply(league)

        return reply(Boom.forbidden())
      })
    },
    assign,
    failAction
  }
}
