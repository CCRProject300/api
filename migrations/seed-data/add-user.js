const Faker = require('faker')
const Async = require('async')
const pick = require('lodash.pick')
const moment = require('moment')
const Password = require('../../lib/password')

const monthAgo = moment().subtract(1, 'months').toDate()

/* Add a user to the DB and hand it back in the callback */
module.exports = (db, company, data, cb) => {
  if (!cb) {
    cb = data
    data = {}
  }

  data = data || {}

  const authData = {
    email: data.email || Faker.internet.email(),
    password: data.password || Faker.internet.password()
  }

  const userData = Object.assign({
    firstName: data.firstName || Faker.name.firstName(),
    lastName: data.lastName || Faker.name.lastName(),
    companyName: company.name || Faker.company.companyName(),
    avatar: data.avatar || Faker.image.avatar(),
    emails: [{address: authData.email.toLowerCase(), verified: true}],
    password: authData.password,
    deleted: false,
    createdAt: monthAgo,
    updatedAt: monthAgo,
    roles: data.roles || ['user'],
    location: Faker.random.arrayElement(company.locations),
    department: Faker.random.arrayElement(company.departments),
    methods: [
      { strategy: 'fitbit' },
      { strategy: 'runkeeper' },
      { strategy: 'strava' }
    ]
  }, pick(data, ['location', 'department']))

  Async.waterfall([
    (cb) => Password.hash(authData.password, cb),
    (hash, cb) => {
      userData.password = hash
      db.users.insert(userData, cb)
    },
    (user, cb) => {
      db.companies.update({ _id: company._id }, { $push: { members: {
        user: user._id,
        startDate: monthAgo,
        active: true,
        activated: true
      }}}, (err) => cb(err, user))
    }
  ], (err, user) => {
    if (err) return cb(err)
    // Stuff the password on the user for testings,
    // otherwise we have to keep auth and user in sync all over the place.
    user.authData = authData
    console.log('Added user', user.firstName, user.lastName, user.emails[0].address, user.authData.password)
    cb(err, user)
  })
}
