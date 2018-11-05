const Faker = require('faker')
const Async = require('async')

/* Add a company league to the DB and hand it back in the callback */
module.exports = (db, company, cb) => {
  Async.waterfall([
    function makeLeague (cb) {
      const size = Math.random()
      let users = company.members.filter(() => {
        return Math.random() > size
      })
      if (!users.length && company.members.length) users = [company.members[0]]
      const leagueData = {
        name: Faker.commerce.productName(),
        description: Faker.company.catchPhrase(),
        startDate: Faker.date.past(),
        endDate: Faker.date.future(),
        moderators: company.moderators,
        members: users,
        deleted: false,
        teamSize: 'individual',
        leagueType: 'corporate'
      }

      db.leagues.insert(leagueData, (err, league) => cb(err, company, league))
    },
    function addLeagueToCompany (company, league, cb) {
      db.companies.update({ _id: company._id }, { $push: { leagues: { leagueId: league._id } } }, (err) => cb(err, league))
    }
  ], (err, leagueData) => {
    if (err) return cb(err)
    console.log('Added league', leagueData.name)
    cb(null)
  })
}
