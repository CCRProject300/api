const faker = require('faker')

module.exports = function (data) {
  data = data || {}

  if (!data.podium) data.podium = []

  const podium = [0, 1, 2].map((user) => {
    return {
      firstName: (data.podium[user] && data.podium[user].firstName) || faker.name.firstName(),
      lastName: (data.podium[user] && data.podium[user].lastName) || faker.name.lastName(),
      avatar: (data.podium[user] && data.podium[user].avatar) || faker.image.avatar()
    }
  })

  delete data.podium

  const fakeStat = {
    globalRanking: faker.random.number(),
    companyName: faker.company.companyName(),
    companyId: faker.random.alphaNumeric(),
    date: new Date(),
    type: 'companyRankings',
    companyAvg: faker.random.number(),
    podium: podium
  }

  return Object.assign({}, fakeStat, data)
}
