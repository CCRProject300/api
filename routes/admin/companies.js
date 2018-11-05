const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const createUserRolePre = require('../prerequisites/user-role')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/admin/companies',
  handler (request, reply) {
    const query = {}
    const fields = { name: 1, startDate: 1, roles: 1, deleted: 1 }
    const sort = { deleted: 1, name: 1 }

    db.companies.find(query, fields).sort(sort, (err, companies) => {
      if (err) return reply(err)
      reply(companies)
    })
  },
  config: {
    description: 'Get all companies',
    auth: 'auth0',
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})
