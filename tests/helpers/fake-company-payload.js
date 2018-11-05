const Faker = require('faker')

module.exports = (data) => {
  return Object.assign({
    name: Faker.company.companyName(),
    description: Faker.lorem.sentence(),
    numberEmployees: Faker.random.number(1000),
    logo: Faker.image.image(),
    locations: [],
    departments: [],
    roles: []
  }, data || {})
}
