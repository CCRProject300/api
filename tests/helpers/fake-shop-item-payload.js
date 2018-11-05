const Faker = require('faker')

module.exports = function fakeShopItemPayload (data) {
  return Object.assign({
    name: Faker.commerce.productName(),
    description: Faker.lorem.paragraph(),
    image: Faker.image.imageUrl(),
    stockLevel: Faker.random.number({ min: 1, max: 1000 }),
    price: Faker.random.number({ min: 1, max: 1000 })
  }, data || {})
}
