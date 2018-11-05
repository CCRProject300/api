const createUserRolePre = require('../prerequisites/user-role')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/admin/users',
  handler (request, reply) {
    const query = { deleted: false }
    const fields = { firstName: 1, lastName: 1, companyName: 1, emails: 1, roles: 1 }
    const sort = { firstName: 1 }

    db.users.find(query, fields).sort(sort, (err, users) => {
      if (err) return reply(err)
      reply(users)
    })
  },
  config: {
    description: 'Get all users',
    auth: 'auth0',
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})
