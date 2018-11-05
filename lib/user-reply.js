const pick = require('lodash.pick')

module.exports = ({ db, user }, cb) => {
  const payload = pick(user, [
    'firstName',
    'lastName',
    'roles',
    'companyName',
    'avatar',
    'department',
    'location',
    'height',
    'weight',
    'gender',
    'dob',
    'emailPreferences',
    'kudosCoins'
  ])

  payload._id = user._id.toString()
  payload.email = user.emails[0].address

  // Convert methods into array of connected method names
  payload.methods = (user.methods || [])
    .filter((m) => !!(m.info && m.info.token))
    .map((m) => m.strategy)

  db.companies.findOne({ 'members.user': user._id, deleted: false }, (err, company) => {
    if (company) payload.company = pick(company, ['_id', 'name'])
    cb(err, payload)
  })
}
