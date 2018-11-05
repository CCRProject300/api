const Joi = require('joi')
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const createUserRolePre = require('../prerequisites/user-role')
const async = require('async')

module.exports.put = ({ db }) => ({
  method: 'PUT',
  path: '/admin/company/{companyId}/departments/{department}',
  handler (request, reply) {
    const { companyId, department } = request.params
    const _id = ObjectId(companyId)

    db.companies.findOne({ _id }, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('Company not found'))
      if (company.departments && company.departments.indexOf(department) >= 0) return reply(Boom.conflict('Department already exists'))

      db.companies.update({ _id }, {$push: {departments: department}}, (err) => {
        if (err) return reply(err)
        return reply().code(201)
      })
    })
  },
  config: {
    description: 'Add a new department to a company (for an admin user)',
    auth: 'auth0',
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.patch = ({ db }) => ({
  method: 'PATCH',
  path: '/admin/company/{companyId}/departments/{department}',
  handler (request, reply) {
    const { companyId } = request.params
    const department = request.params.department
    const newDepartment = request.payload.department
    const _id = ObjectId(companyId)

    async.waterfall([
      (cb) => db.companies.findOne({ _id }, {name: 1, departments: 1}, cb),
      (company, cb) => {
        if (!company) return reply(Boom.notFound('Company not found'))
        const { name: companyName, departments } = company
        if (departments && departments.indexOf(department) < 0) return reply(Boom.notFound('Company department not found'))

        db.companies.update({
          _id,
          departments: department
        }, {$set: { 'departments.$': newDepartment }}, (err, update) => {
          cb(err, companyName)
        })
      },
      (companyName, cb) => {
        db.users.update({ companyName, department }, {$set: {department: newDepartment}}, {multi: true}, cb)
      }
    ], (err, update) => {
      if (err) return reply(err)
      const newResource = request.url.path.replace(encodeURIComponent(department), encodeURIComponent(newDepartment))
      reply().header('location', newResource).code(204)
    })
  },
  config: {
    description: 'Update a department for a company and it\'s users',
    auth: 'auth0',
    validate: {
      payload: {
        department: Joi.string().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/admin/company/{companyId}/departments/{department}',
  handler (request, reply) {
    const _id = ObjectId(request.params.companyId)
    db.companies.findOne({ _id }, {name: 1}, (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('Company not found'))
      const companyName = company.name
      const department = request.params.department

      if (!department) return reply(Boom.notFound('Company department is missing'))

      async.parallel([
        (done) => {
          db.users.update({ companyName, department }, {$unset: {department: 1}}, {multi: true}, done)
        },
        (done) => {
          db.companies.update({ _id }, {$pull: {departments: department}}, done)
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
