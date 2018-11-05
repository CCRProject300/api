const Faker = require('faker')
const moment = require('moment')

/* Add a user to the DB and hand it back in the callback */
module.exports = (db, data, cb) => {
  if (!cb) {
    cb = data
    data = {}
  }

  data = data || {}

  const auth0Id = data.auth0Id || Faker.internet.password()
  const authData = {
    email: (data.email || Faker.internet.email()).toLowerCase(),
    auth0Id
  }

  let userData = {
    firstName: data.firstName || Faker.name.firstName(),
    lastName: data.lastName || Faker.name.lastName(),
    auth0Id,
    emails: [{address: authData.email.toLowerCase(), verified: true}],
    deleted: false,
    createdAt: moment.utc().toDate(),
    updatedAt: moment.utc().toDate(),
    roles: data.roles || ['user'],
    emailPreferences: {
      league: true,
      podium: true,
      leaderboard: true,
      connected: true
    },
    height: Faker.random.number(),
    weight: Faker.random.number(),
    dob: Faker.date.past(),
    gender: ((Faker.random.number() % 2) === 0) ? 'male' : 'female'
  }

  if (data.emailPreferences) {
    userData.emailPreferences = Object.assign({}, userData.emailPreferences, data.emailPreferences)
    delete data.emailPreferences
  }

  if (data) userData = Object.assign({}, userData, data)

  db.users.insert(userData, (err, user) => {
    if (err) return cb(err)
    // Stuff the password on the user for testings,
    // otherwise we have to keep auth and user in sync all over the place.
    user.authData = authData
    console.log('Added user', user.authData.email, user.authData.auth0Id)
    cb(err, user)
  })
}
