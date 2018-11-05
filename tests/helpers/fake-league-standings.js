const faker = require('faker')

module.exports = function (data) {
  data = data || {}

  const fakeLeagueStanding = {
    date: new Date(),
    type: 'leagueStandings',
    leagueName: faker.random.words(),
    leagueId: faker.random.alphaNumeric(),
    ranking: faker.random.number(),
    rankingProgress: (faker.random.number() % 2) === 0 ? 1 : -1,
    name: faker.commerce.department() + ' ' + faker.company.bsBuzz(),
    active: true,
    activated: true,
    startDate: faker.date.past(),
    userId: null,
    members: [],
    score: faker.random.number()
  }

  return Object.assign({}, fakeLeagueStanding, data)
}
