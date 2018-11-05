const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId
const fakeUserRef = require('./fake-user-ref')

module.exports = function fakeCharityBucket (data) {
  data = data || {}

  const target = Faker.random.number({ min: 100, max: 5000 })
  const donations = Array(Faker.random.number({ min: 1, max: 5 })).fill(0).map(() => ({
    user: fakeUserRef(),
    kudosCoins: Faker.random.number({ min: 1, max: 10 }),
    createdAt: Faker.date.past()
  }))
  const total = (data.donations || donations).reduce((sum, d) => sum + d.kudosCoins, 0)

  return Object.assign({
    company: { _id: ObjectId() },
    name: Faker.commerce.productName(),
    description: Faker.lorem.paragraph(),
    logo: Faker.image.imageUrl(),
    image: Faker.image.imageUrl(),
    target,
    total,
    donations,
    autoClose: Faker.random.boolean(),
    closed: false,
    deleted: false,
    createdAt: Faker.date.past()
  }, data)
}
