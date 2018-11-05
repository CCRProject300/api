const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId

module.exports = function fakeShopItem (data) {
  return Object.assign({
    company: { _id: ObjectId() },
    name: Faker.commerce.productName(),
    description: Faker.lorem.paragraph(),
    image: Faker.image.imageUrl(),
    stockLevel: Faker.random.number({ min: 1, max: 1000 }),
    price: Faker.random.number({ min: 1, max: 1000 }),
    deleted: false,
    createdAt: Faker.date.past()
  }, data || {})
}
