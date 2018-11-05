const Async = require('async')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const createCompanyMemberPre = require('./prerequisites/company-member')
const createUserRolePre = require('./prerequisites/user-role')
const { hasRole } = require('../lib/roles')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/shop/items',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const { company } = request.pre

    Async.waterfall([
      (cb) => db.users.findOne({ _id: userId }, cb),
      (user, cb) => {
        const query = { 'company._id': company._id, deleted: false }

        // Return ALL items for corporate_mod/admin, in-stock items for everyone else
        if (!hasRole(user, ['corporate_mod', 'admin'])) {
          query.stockLevel = { $gt: 0 }
        }

        db.shopItems.find(query).sort({ createdAt: -1 }, cb)
      }
    ], reply)
  },
  config: {
    description: 'Get all items in the company shop',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyMemberPre({ db }),
      createUserRolePre({ db, role: 'rewards' })
    ]
  }
})
