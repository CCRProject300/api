const Faker = require('faker')
const Async = require('async')

/* Add a company to the DB and hand it back in the callback */
/* Pass "modCount" in the data object to add more than one moderator */
module.exports = (db, data, cb) => {
  if (!cb) {
    cb = data
    data = {}
  }

  data = data || {}

  const modCount = data.modCount || 1
  delete data.modCount

  Async.waterfall([
    function selectUserIds (cb) {
      const moderatorIds = data.users.slice(0, modCount).map(({ _id }) => _id)
      const userIds = data.users.map(({ _id }) => _id)
      cb(null, moderatorIds, userIds)
    },
    function makeCompany (moderatorIds, userIds, cb) {
      const moderators = moderatorIds.map((id) => {
        return {
          user: id,
          startDate: Faker.date.past(),
          endDate: Faker.date.future(),
          active: true,
          activated: true
        }
      })
      const users = userIds.map((id) => {
        return {
          user: id,
          startDate: Faker.date.past(),
          endDate: Faker.date.future(),
          active: !data.deactivateUser || data.deactivateUser.toString() !== id.toString(),
          activated: true
        }
      })
      const compData = Object.assign({
        name: data.name || Faker.company.companyName(),
        description: Faker.lorem.sentence(),
        startDate: Faker.date.past(),
        endDate: Faker.date.future(),
        numberEmployees: data.users.length,
        leagues: [],
        locations: data.locations || [],
        departments: data.departments || [],
        logo: data.logo || Faker.image.imageUrl(),
        roles: [],
        deleted: false
      }, data, {
        moderators,
        members: users
      })

      db.companies.insert(compData, (err) => cb(err, compData, moderatorIds))
    },
    function makeUsersCorporateMod (compData, moderatorIds, cb) {
      if (!moderatorIds.length) return cb(null, compData)
      const query = { _id: { $in: moderatorIds } }
      const update = { $addToSet: { roles: ['corporate_mod'] } }
      db.users.update(query, update, { multi: true }, (err) => cb(err, compData))
    }
  ], (err, compData) => {
    if (err) return cb(err)
    console.log('Added company', compData.name, ' with ', data.users.length, ' users')
    cb(null, compData)
  })
}
