const Boom = require('boom')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const createUserRolePre = require('../prerequisites/user-role')

// TODO: User names should be denormalised onto group members/moderators
module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/admin/company/{companyId}/moderators',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const query = { _id: companyId }
    const fields = { moderators: 1 }

    db.companies.findOne(query, fields, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('Company not found'))

      getCompanyModeratorsReply(db, company, (err, moderators) => {
        if (err) return reply(err)
        reply(moderators)
      })
    })
  },
  config: {
    description: 'Get company moderators',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.post = ({ db }) => ({
  method: 'POST',
  path: '/admin/company/{companyId}/moderators',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const query = { _id: companyId }
    const fields = { moderators: 1, name: 1 }

    db.companies.findOne(query, fields, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('Company not found'))

      const existingModerators = company.moderators || []

      const userIds = request.payload.filter((id) => {
        return !existingModerators.some((m) => m.user.toString() === id.toString())
      })

      if (!userIds.length) {
        return getCompanyModeratorsReply(db, company, (err, moderators) => {
          if (err) return reply(err)
          reply(moderators)
        })
      }

      const moderators = userIds.map((id) => ({
        user: ObjectId(id),
        active: true,
        activated: false
      }))

      const update = { $push: { moderators: { $each: moderators } } }

      const notification = {
        type: 'corpModInvite',
        group: { _id: company._id, name: company.name },
        messages: ['You have been invited to be a moderator for the company ', 'Do you want to accept?'],
        deleted: false
      }

      Async.waterfall([
        function updateCompany (cb) {
          db.companies.update({ _id: company._id }, update, cb)
        },
        function addNotifications (res, cb) {
          const bulkNotificationOp = db.notifications.initializeUnorderedBulkOp()
          userIds.forEach((userId) => {
            bulkNotificationOp.insert(Object.assign({ user: { _id: ObjectId(userId) } }, notification))
          })
          bulkNotificationOp.execute((err) => {
            if (err) return cb(err)
            cb()
          })
        },
        function getMembersForResponse (cb) {
          company.moderators = existingModerators.concat(moderators)
          getCompanyModeratorsReply(db, company, cb)
        }
      ], (err, moderators) => {
        if (err) return reply(err)
        reply(moderators)
      })
    })
  },
  config: {
    description: 'Create new company moderator(s)',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      },
      payload: Joi.array().items(Joi.objectId()).min(1).required()
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

function getCompanyModeratorsReply (db, company, cb) {
  const userIds = (company.moderators || []).map((m) => m.user)

  const query = { _id: { $in: userIds } }
  const fields = { firstName: 1, lastName: 1 }

  db.users.find(query, fields, (err, users) => {
    if (err) return cb(err)

    const getUserName = (id) => {
      const user = users.find((u) => u._id.toString() === id.toString())
      if (!user) return {}
      if (!user.lastName) return { firstName: user.firstName }
      if (!user.firstName) return { lastName: user.lastName }
      return { firstName: user.firstName, lastName: user.lastName }
    }

    const moderators = (company.moderators || []).map((m) => Object.assign({
      _id: m.user,
      activated: m.activated,
      startDate: m.startDate
    }, getUserName(m.user)))

    cb(null, moderators)
  })
}
