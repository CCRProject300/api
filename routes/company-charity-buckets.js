const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const createCompanyMemberPre = require('./prerequisites/company-member')
const createUserRolePre = require('./prerequisites/user-role')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/charity/buckets',
  handler (request, reply) {
    const query = { 'company._id': ObjectId(request.params.companyId), deleted: false }
    const fields = { company: 1, name: 1, logo: 1, target: 1, total: 1 }

    db.charityBuckets.find(query, fields).sort({ createdAt: -1 }, (err, buckets) => {
      if (err) return reply(err)
      reply(buckets)
    })
  },
  config: {
    description: 'Get all charity buckets for a company',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyMemberPre({ db }),
      createUserRolePre({ db, role: 'charity-rewards' })
    ]
  }
})
