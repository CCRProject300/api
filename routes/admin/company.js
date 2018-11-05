const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const moment = require('moment')
const config = require('config')
const createUserRolePre = require('../prerequisites/user-role')
const companyReply = require('../../lib/company-reply')
const async = require('async')
const without = require('lodash.without')

const companyRoles = config.companyRoles || []

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/admin/company/{companyId}',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    db.companies.findOne({_id: companyId}, {
      name: 1,
      numberEmployees: 1,
      description: 1,
      locations: 1,
      departments: 1,
      logo: 1,
      deleted: 1
    }, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound())
      reply(company)
    })
  },
  config: {
    description: 'Get a company (for an admin user)',
    auth: 'auth0',
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.post = ({ db, uploadcare }) => ({
  method: 'POST',
  path: '/admin/company',
  handler (request, reply) {
    const companyData = Object.assign({
      startDate: moment.utc().toDate(),
      moderators: [],
      members: [],
      deleted: false
    }, request.payload)

    db.companies.insert(companyData, (err, company) => {
      if (err) return reply(err)
      uploadcare.store(company.logo)
      reply(companyReply(company)).code(201)
    })
  },
  config: {
    description: 'Create a new company',
    auth: 'auth0',
    validate: {
      payload: {
        name: Joi.string().required(),
        description: Joi.string(),
        numberEmployees: Joi.number().integer().default(0),
        logo: Joi.string().uri(),
        locations: Joi.array().items(Joi.string().required()),
        departments: Joi.array().items(Joi.string().required()),
        roles: Joi.array().items(Joi.string().valid(companyRoles)).default([])
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.patch = ({ db, uploadcare }) => ({
  method: 'PATCH',
  path: '/admin/company/{companyId}',
  handler (request, reply) {
    let oldCompanyDetails = null
    const newCompanyDetails = request.payload
    const _id = ObjectId(request.params.companyId)

    async.waterfall([
      (cb) => db.companies.findOne({ _id }, cb),
      (companyDetails, cb) => {
        if (!companyDetails) return reply(Boom.notFound())
        oldCompanyDetails = companyDetails
        db.companies.update({ _id }, {$set: newCompanyDetails}, cb)
      },
      (update, cb) => {
        const { logo } = newCompanyDetails
        if (!logo || logo === oldCompanyDetails.logo) return cb(null, oldCompanyDetails)
        uploadcare.store(logo)
        cb(null, oldCompanyDetails)
      },
      (oldCompanyDetails, cb) => {
        const companyName = oldCompanyDetails.name
        const updatedCompanyName = newCompanyDetails.name
        const userIds = oldCompanyDetails.members.concat(oldCompanyDetails.moderators).map(({ user }) => user)

        if (companyName === updatedCompanyName) return cb(null, userIds)

        db.users.update({ _id: { $in: userIds } }, {
          $set: {
            companyName: updatedCompanyName
          }
        }, {multi: true}, (err) => cb(err, userIds))
      },
      (userIds, cb) => {
        if (!newCompanyDetails.roles) return cb()

        const rolesToRemove = without.apply(null, [companyRoles].concat(newCompanyDetails.roles))
        // users need to be updated in two stages as Mongo cannot apply two top-level update operators to the
        // same field in the same operation
        async.parallel([
          (done) => db.users.update({ _id: { $in: userIds } }, {
            $pullAll: { roles: rolesToRemove }
          }, {multi: true}, done),
          (done) => db.users.update({ _id: { $in: userIds } }, {
            $addToSet: { roles: { $each: newCompanyDetails.roles } }
          }, {multi: true}, done)
        ], (err) => cb(err))
      },
      (cb) => {
        db.companies.findOne({ _id }, {
          name: 1,
          numberEmployees: 1,
          description: 1,
          locations: 1,
          departments: 1,
          logo: 1,
          deleted: 1,
          roles: 1
        }, cb)
      }
    ], reply)
  },
  config: {
    description: 'Update a company',
    auth: 'auth0',
    validate: {
      payload: {
        name: Joi.string().min(2),
        description: Joi.string(),
        numberEmployees: Joi.number().integer().default(0).min(1),
        logo: Joi.string().uri(),
        deleted: Joi.boolean(),
        roles: Joi.array().items(Joi.string().valid(companyRoles))
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/admin/company/{companyId}',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const query = { _id: companyId }
    const update = { $set: { deleted: true } }

    db.companies.update(query, update, (err) => {
      if (err) return reply(err)
      db.notifications.update({
        'group._id': companyId,
        deleted: false,
        redeemedAt: null,
        type: { $in: ['corpModInvite', 'companyInvite'] }
      }, { $set: { deleted: true } }, { multi: true }, (err) => {
        if (err) return reply(err)
        reply().code(204)
      })
    })
  },
  config: {
    description: 'Delete a company',
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
