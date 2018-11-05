const faker = require('faker')

module.exports = function (data) {
  data = data || {}

  const fakeLeague = {
    name: faker.commerce.productName(),
    description: faker.lorem.sentences(),
    startDate: faker.date.past(),
    endDate: faker.date.future(),
    moderators: [],
    members: [],
    deleted: false,
    teamSize: 1,
    leagueType: 'corporate'
  }

  return Object.assign({}, fakeLeague, data)
}
