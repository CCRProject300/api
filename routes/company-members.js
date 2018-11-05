const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const pick = require('lodash.pick')
const Async = require('async')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')

// TODO: User names should be denormalised onto group members/moderators
module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/members',
  handler (request, reply) {
    getCompanyMembersReply(db, request.pre.company, (err, members) => {
      if (err) return reply(err)
      reply(members)
    })
  },
  config: {
    description: 'Get company members',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})

module.exports.post = ({ db }) => ({
  method: 'POST',
  path: '/company/{companyId}/members',
  handler (request, reply) {
    const company = request.pre.company
    const existingMembers = company.members || []

    const userIds = request.payload.filter((id) => {
      return !existingMembers.some((m) => m.user.toString() === id.toString())
    })

    if (!userIds.length) {
      return getCompanyMembersReply(db, company, (err, members) => {
        if (err) return reply(err)
        reply(members)
      })
    }

    const members = userIds.map((id) => ({
      user: ObjectId(id),
      active: true,
      activated: false
    }))

    const update = { $push: { members: { $each: members } } }

    const notification = {
      type: 'companyInvite',
      group: { _id: company._id, name: company.name },
      messages: ['You have been invited to join the company ', 'Do you want to accept?'],
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
        company.members = existingMembers.concat(members)
        getCompanyMembersReply(db, company, cb)
      }
    ], (err, members) => {
      if (err) return reply(err)
      reply(members)
    })
  },
  config: {
    description: 'Add new company members(s)',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      },
      payload: Joi.array().items(Joi.objectId()).min(1).required()
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})

function getCompanyMembersReply (db, company, cb) {
  const userIds = (company.members || []).map((m) => m.user)

  const query = { _id: { $in: userIds } }
  const fields = { firstName: 1, lastName: 1, department: 1, location: 1, avatar: 1 }

  db.users.find(query, fields, (err, users) => {
    if (err) return cb(err)

    const getUserDetails = (id) => {
      const user = users.find((u) => u._id.toString() === id.toString())
      if (!user) return {}
      return pick(user, [
        'firstName',
        'lastName',
        'department',
        'location',
        'avatar'
      ])
    }

    const members = (company.members || []).map((m) => Object.assign({
      _id: m.user,
      activated: m.activated,
      startDate: m.startDate
    }, getUserDetails(m.user)))

    cb(null, members)
  })
}
