const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const leagueReply = require('../lib/league-reply')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/leagues',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)

    // Get leagues for which:
    // user is a moderator and it is a private league
    // OR
    // user is a member
    // OR
    // it is a public league
    db.leagues
      .find({
        $or: [{
          moderators: { $elemMatch: { user: userId, activated: true, active: true } },
          leagueType: 'private'
        }, {
          members: { $elemMatch: { user: userId, activated: true, active: true } }
        }, {
          leagueType: 'public'
        }],
        deleted: false
      })
      .sort({ endDate: -1 }, (err, leagues) => {
        if (err) return reply(err)
        Async.map(leagues, (l, cb) => {
          leagueReply({ db, league: l, userId }, cb)
        }, (err, league) => {
          if (err) return reply(err)
          reply(league)
        })
      })
  },
  config: {
    description: 'Get all leagues for a user',
    auth: 'auth0'
  }
})
