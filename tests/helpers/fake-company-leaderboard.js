const faker = require('faker')

module.exports = function (data) {
  data = data || {}

  const fakeLeaderboard = {
    companyId: faker.random.alphaNumeric(),
    date: new Date(),
    type: 'companyLeaderboard',
    leaderboard: {
      users: fillWithNamesAndPoints(),
      locations: fillWithNamesAndPoints(),
      departments: fillWithNamesAndPoints(),
      leagues: fillWithNamesAndPoints()
    }
  }

  return Object.assign({}, fakeLeaderboard, data)
}

function fillWithNamesAndPoints () {
  return {
    all: new Array(5).map(createNameAndPoints),
    week: new Array(5).map(createNameAndPoints),
    month: new Array(5).map(createNameAndPoints)
  }
}

function createNameAndPoints () {
  return {name: faker.name.firstName(), points: faker.random.number()}
}
