const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId

module.exports = function fakeTransactionLog (data) {
  data = data || {}

  const type = Faker.random.arrayElement([
    'purchase',
    'distribution',
    'donation',
    'daily-coin',
    'activity',
    'activity-adjustment'
  ])

  return Object.assign({
    company: { _id: ObjectId() },
    createdAt: Faker.date.recent(),
    createdBy: {
      _id: ObjectId(),
      firstName: Faker.name.firstName(),
      lastName: Faker.name.lastName(),
      avatar: Faker.image.avatar()
    },
    user: {
      _id: ObjectId(),
      firstName: Faker.name.firstName(),
      lastName: Faker.name.lastName(),
      avatar: Faker.image.avatar()
    },
    reason: data.type || type,
    type: type,
    kudosCoins: Faker.random.number({ min: -10, max: -1 }),
    data: {}
  }, data)
}
