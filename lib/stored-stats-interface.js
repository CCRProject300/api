const moment = require('moment')
const Async = require('async')
const pick = require('lodash.pick')

module.exports = function (db) {
  return (user, cb) => {
    Async.parallel({
      standings: getStandings.bind(null, user),
      rankings: getRankings.bind(null, user),
      leagues: getLeagues.bind(null, user)
    }, cb)
  }

  function getLeagues (user, cb) {
    const today = moment.utc().startOf('day').toDate()

    db.dailyStats.find({
      type: 'leagueStandings',
      members: user._id,
      date: today
    }, (err, data) => {
      if (err) return cb(err)

      const leagues = data.map((todayData) => ({
        name: todayData.leagueName,
        userIds: todayData.members,
        ranking: todayData.ranking,
        progress: todayData.rankingProgress
      }))
      cb(null, leagues)
    })
  }

  function getStandings (user, cb) {
    const today = moment.utc().startOf('day').toDate()

    Async.waterfall([
      function getCompanies (done) {
        db.companies.find({ 'members.user': user._id }, { _id: 1 }, done)
      },
      function getStandingsDocs (companies, done) {
        const companyIds = companies.map((c) => c._id)
        companyIds.push('ALL')
        db.dailyStats.find({
          type: 'groupStandings',
          date: today,
          companyId: { $in: companyIds }
        }, done)
      }
    ], function getUserStanding (err, standingsDocs) {
      if (err) return cb(err)

      const standings = standingsDocs.reduce((memo, doc) => {
        const userStanding = doc.standings.find((s) => s._id.equals(user._id))
        if (userStanding) {
          memo.push({
            title: doc.title,
            percent: userStanding.percent,
            ranking: userStanding.ranking
          })
        }
        return memo
      }, [])
      cb(null, standings)
    })
  }

  function getRankings (user, cb) {
    const today = moment.utc().startOf('day').toDate()

    Async.waterfall([
      function getCompanies (done) {
        db.companies.find({ 'members.user': user._id }, { _id: 1 }, done)
      },
      function getRankingsDocs (companies, done) {
        const companyIds = companies.map((c) => c._id)
        db.dailyStats.find({
          type: 'companyRankings',
          date: today,
          companyId: { $in: companyIds }
        }, done)
      }
    ], (err, rankingsDocs) => {
      if (err) return cb(err)

      cb(null, rankingsDocs.map((doc) => pick(doc, ['companyName', 'globalRanking', 'podium', 'date'])))
    })
  }
}
