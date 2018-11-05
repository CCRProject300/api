const Faker = require('faker')
const ObjectId = require('mongojs').ObjectId

module.exports = (data) => {
  return Object.assign({
    _id: ObjectId(),
    firstName: Faker.name.firstName(),
    lastName: Faker.name.lastName(),
    avatar: Faker.image.avatar()
  }, data)
}
