// Swaps "individual", "small", "medium" and "large" for numerical sizes, and adds minTeamSize where required
const Async = require('async')

const sizeMap = {
  'individual': 1,
  'small': 5,
  'medium': 20,
  'large': null
}

module.exports = function (cb) {
  this.db.groups.find({ __t: 'League' }, (err, leagues) => {
    if (err) return cb(err)

    Async.eachLimit(leagues, 10, (league, done) => {
      let updatedLeague = Object.assign({}, league, {
        teamSize: sizeMap[league.teamSize]
      })
      if (updatedLeague.teamSize !== 1) updatedLeague.minTeamSize = 1
      this.db.groups.update({ _id: league._id }, updatedLeague, done)
    }, cb)
  })
}
