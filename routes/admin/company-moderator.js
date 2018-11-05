const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const createUserRolePre = require('../prerequisites/user-role')

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/admin/company/{companyId}/moderator/{userId}',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const userId = ObjectId(request.params.userId)

    Async.waterfall([
      function removeFromCompany (cb) {
        const query = { _id: companyId }
        const update = { $pull: { moderators: { user: userId } } }
        db.companies.update(query, update, (err) => cb(err))
      },
      // Remove corporate_mod role if not moderating other companies
      function stripRole (cb) {
        const query = { 'moderators.user': userId }

        db.companies.count(query, (err, count) => {
          if (err) return cb(err)
          if (count) return cb()

          db.users.update({
            _id: userId,
            roles: 'corporate_mod'
          }, {
            $pull: { roles: 'corporate_mod' }
          }, (err) => cb(err))
        })
      },
      function cancelNofitications (cb) {
        db.notifications.update({
          'user._id': userId,
          'group._id': companyId,
          deleted: false,
          redeemedAt: null,
          type: 'corpModInvite'
        }, { $set: { deleted: true } }, (err) => cb(err))
      }
    ], (err) => {
      if (err) return reply(err)
      reply().code(204)
    })
  },
  config: {
    description: 'Delete a moderator',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        userId: Joi.objectId().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})
