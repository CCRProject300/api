const Joi = require('joi')
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const createUserRolePre = require('../prerequisites/user-role')
const async = require('async')

module.exports.put = ({ db }) => ({
  method: 'PUT',
  path: '/admin/company/{companyId}/locations/{location}',
  handler (request, reply) {
    const { companyId, location } = request.params
    const _id = ObjectId(companyId)

    db.companies.findOne({ _id }, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('Company not found'))
      if (company.locations && company.locations.indexOf(location) >= 0) return reply(Boom.conflict('Location already exists'))

      db.companies.update({ _id }, {$push: {locations: location}}, (err) => {
        if (err) return reply(err)
        return reply().code(201)
      })
    })
  },
  config: {
    description: 'Add a new location to a company (for an admin user)',
    auth: 'auth0',
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.patch = ({ db }) => ({
  method: 'PATCH',
  path: '/admin/company/{companyId}/locations/{location}',
  handler (request, reply) {
    const { companyId, location } = request.params
    const newLocation = request.payload.location
    const _id = ObjectId(companyId)

    async.waterfall([
      (cb) => db.companies.findOne({ _id }, {name: 1, locations: 1}, cb),
      (company, cb) => {
        if (!company) return reply(Boom.notFound('Company not found'))
        const { name: companyName, locations } = company
        if (locations && locations.indexOf(location) < 0) return reply(Boom.notFound('Company location not found'))

        db.companies.update({
          _id,
          locations: location
        }, {$set: { 'locations.$': newLocation }}, (err, update) => {
          cb(err, companyName)
        })
      },
      (companyName, cb) => {
        db.users.update({ companyName, location }, {$set: {location: newLocation}}, {multi: true}, cb)
      }
    ], (err, update) => {
      if (err) return reply(err)
      const newResource = request.url.path.replace(encodeURIComponent(location), encodeURIComponent(newLocation))
      reply().header('location', newResource).code(204)
    })
  },
  config: {
    description: 'Update a location for a company and it\'s users',
    auth: 'auth0',
    validate: {
      payload: {
        location: Joi.string().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/admin/company/{companyId}/locations/{location}',
  handler (request, reply) {
    const _id = ObjectId(request.params.companyId)
    db.companies.findOne({ _id }, {name: 1}, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('Company not found'))

      const companyName = company.name
      const location = request.params.location

      if (!location) return reply(Boom.notFound('Company location is missing'))

      async.parallel([
        (done) => {
          db.users.update({ companyName, location }, {$unset: {location: 1}}, {multi: true}, done)
        },
        (done) => {
          db.companies.update({ _id }, {$pull: {locations: location}}, done)
        }
      ], (err, tasks) => {
        if (err) return reply(err)
        reply().code(204)
      })
    })
  },
  config: {
    description: 'Delete a company\'s department',
    auth: 'auth0',
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})
