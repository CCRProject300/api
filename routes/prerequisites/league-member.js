const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')
const teamDataHelpers = require('../../lib/team-data-helpers')

// Restrict route to users who are members **or** moderators of a given league
// Requires {leagueId} path param and config.auth = 'auth0' to be set on the route
module.exports = ({ db, leagueIdParam = 'leagueId', assign = 'league', failAction = 'error' }) => {
  const { isLeagueMember } = teamDataHelpers(db)

  return {
    method (request, reply) {
      const userId = ObjectId(request.auth.credentials)
      const leagueId = ObjectId(request.params[leagueIdParam])

      db.leagues.findOne({ _id: leagueId, deleted: false }, (err, league) => {
        if (err) return reply(err)
        if (!league) return reply(Boom.notFound())

        isLeagueMember({ league, userId }, (err, isMember) => {
          if (err) return reply(err)

          if (isMember) return reply(league)
          return reply(Boom.forbidden())
        })
      })
    },
    assign,
    failAction
  }
}
