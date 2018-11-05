const fakeLeague = require('./fake-league')
const ObjectId = require('mongojs').ObjectId
const faker = require('faker')

/* Add a league with users to the DB and hand it back in the callback */
module.exports = (db, data, cb) => {
  if (!cb) {
    cb = data
    data = {}
  }

  data = data || {}

  const startDate = faker.date.past()
  const league = fakeLeague(Object.assign(data, {
    members: data.members.map((member) => {
      return {
        user: ObjectId(member._id),
        active: true,
        activated: true,
        startDate: startDate
      }
    }),
    moderators: [{
      user: ObjectId(data.members[0]._id),
      active: true,
      activated: true,
      startDate: startDate
    }]
  }))

  db.leagues.insert(league, (err, league) => {
    if (err) return cb(err)
    console.log(`Created league called ${league.name} with ${league.members.length} members`)
    cb(null, league)
  })
}
