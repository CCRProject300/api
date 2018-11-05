const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId

module.exports = (data) => {
  return Object.assign({
    name: Faker.company.companyName(),
    description: Faker.lorem.sentence(),
    numberEmployees: Faker.random.number(1000),
    logo: Faker.image.image(),
    locations: [],
    departments: [],
    startDate: Faker.date.past(),
    endDate: Faker.date.future(),
    moderators: [],
    members: [],
    deleted: false,
    leagues: []
  }, data || {})
}

function fakeMember (data) {
  return Object.assign({
    user: new ObjectId(),
    startDate: Faker.date.past(),
    endDate: Faker.date.future(),
    active: true,
    activated: true
  }, data || {})
}

module.exports.fakeMember = fakeMember
module.exports.fakeModerator = fakeMember
