const Joi = require('joi')
const Async = require('async')
const ObjectId = require('mongojs').ObjectId

module.exports.get = ({ db }) => {
  return {
    method: 'GET',
    path: '/search/users',
    handler (request, reply) {
      Async.waterfall([
        function getCompany (cb) {
          if (!request.query.companyId) return cb(null, null)
          db.companies.findOne({ _id: ObjectId(request.query.companyId) }, { 'members.user': 1 }, cb)
        },

        function findUsers (company, cb) {
          const fields = { firstName: 1, lastName: 1, avatar: 1, location: 1, department: 1 }
          const query = { $text: { $search: request.query.q }, deleted: false }
          if (company) query._id = { $in: company.members.map((m) => m.user) }

          db.users.find(query, fields, cb)
        }
      ], (err, users) => {
        if (err) return reply(err)
        reply(users)
      })
    },
    config: {
      description: 'Search for users',
      auth: 'auth0',
      validate: {
        query: {
          q: Joi.string().required(),
          companyId: Joi.string()
        }
      }
    }
  }
}
