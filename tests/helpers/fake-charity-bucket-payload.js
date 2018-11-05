const Faker = require('faker')

module.exports = function fakeCharityBucketPayload (data) {
  return Object.assign({
    name: Faker.commerce.productName(),
    description: Faker.lorem.paragraph(),
    logo: Faker.image.imageUrl(),
    image: Faker.image.imageUrl(),
    target: Faker.random.number({ min: 100, max: 5000 }),
    autoClose: Faker.random.boolean(),
    closed: false
  }, data)
}
