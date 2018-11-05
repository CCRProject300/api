const ObjectId = require('mongojs').ObjectId
const companyReply = require('../lib/company-reply')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/companies',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    // Get companies for which user is a moderator OR member
    const query = {
      $or: [{
        moderators: { $elemMatch: { user: userId, activated: true, active: true } }
      }, {
        members: { $elemMatch: { user: userId, activated: true, active: true } }
      }],
      deleted: false
    }

    db.companies.find(query, (err, companies) => {
      if (err) return reply(err)
      reply(companies.map(companyReply))
    })
  },
  config: {
    description: 'Get all companies for a user',
    auth: 'auth0'
  }
})
