const pick = require('lodash.pick')

module.exports = (company) => {
  let payload = pick(company, [
    'name',
    'description',
    'logo',
    'startDate',
    'endDate',
    'departments',
    'locations',
    'roles'
  ])
  payload._id = company._id.toString()

  return payload
}
