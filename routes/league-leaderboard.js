const createLeagueMemberPre = require('./prerequisites/league-member')
const LeagueRankings = require('kudoshealth-lib').leagueRankings

module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/league/{leagueId}/leaderboard',
    handler (request, reply) {
      const league = request.pre.league

      LeagueRankings.get({ db, group: league }, (err, leaderboard) => {
        if (err) return reply(err)
        reply(leaderboard)
      })
    },
    config: {
      description: 'Get leaderboard for the given league',
      auth: 'auth0',
      pre: [
        createLeagueMemberPre({ db })
      ]
    }
  }
}
