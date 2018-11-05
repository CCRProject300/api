const Faker = require('faker')

module.exports = (data) => {
  return Object.assign({
    firstName: Faker.name.firstName(),
    lastName: Faker.name.lastName(),
    email: Faker.internet.email().toLowerCase()
  }, data || {})
}
