const faker = require('faker')

module.exports = function (data) {
  data = data || {}

  const fakeStandings = {
    company: {
      name: faker.company.companyName(),
      data: {
        monthlyAverage: faker.random.number(),
        age: {
          '16-24': faker.random.number(),
          '25-34': faker.random.number(),
          '35-44': faker.random.number(),
          '45-54': faker.random.number(),
          '55-64': faker.random.number(),
          '65+': faker.random.number()
        },
        gender: {
          Male: faker.random.number(),
          Female: faker.random.number(),
          Other: faker.random.number()
        }
      }
    },
    community: {
      name: 'KudosHealth',
      data: {
        monthlyAverage: faker.random.number(),
        age: {
          '16-24': faker.random.number(),
          '25-34': faker.random.number(),
          '35-44': faker.random.number(),
          '45-54': faker.random.number(),
          '55-64': faker.random.number(),
          '65+': faker.random.number()
        },
        gender: {
          Male: faker.random.number(),
          Female: faker.random.number(),
          Other: faker.random.number()
        }
      }
    }
  }

  return Object.assign({}, fakeStandings, data)
}
