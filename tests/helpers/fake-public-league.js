const faker = require('faker')
const moment = require('moment')

function fakePublicLeaguePayload () {
  return {
    name: faker.commerce.productName(),
    description: faker.lorem.sentences(),
    startDate: moment.utc(faker.date.past()).toISOString(),
    endDate: moment.utc(faker.date.future()).toISOString(),
    teamSize: null,
    minTeamSize: 1,
    branding: {
      logo: faker.internet.url() + '/' + faker.random.uuid(),
      heroImage: faker.internet.url() + '/' + faker.random.uuid(),
      title: faker.random.word(),
      body: faker.lorem.paragraph()
    }
  }
}

module.exports = function (data) {
  data = data || {}

  const fakeLeague = fakePublicLeaguePayload()

  return Object.assign(fakeLeague, {
    members: [],
    public: true,
    leagueType: 'public',
    panel: [],
    deleted: false
  }, data)
}

module.exports.fakePublicLeaguePayload = fakePublicLeaguePayload
