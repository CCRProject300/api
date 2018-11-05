const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')

// Restrict route to users who are members **or** moderators of a given company
// Requires {companyId} path param and config.auth = 'auth0' to be set on the route
module.exports = ({ db, companyIdParam = 'companyId', assign = 'company', failAction = 'error' }) => ({
  method (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const companyId = ObjectId(request.params[companyIdParam])
    const query = {
      _id: companyId,
      $or: [{
        moderators: {
          $elemMatch: { user: userId, activated: true, active: true }
        }
      }, {
        members: {
          $elemMatch: { user: userId, activated: true, active: true }
        }
      }],
      deleted: false
    }

    db.companies.findOne(query, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.forbidden())

      reply(company)
    })
  },
  assign,
  failAction
})
