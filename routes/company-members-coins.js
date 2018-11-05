const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const Boom = require('boom')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')

const USER_ID_CHUNK_SIZE = 50

module.exports.post = ({ db, mailer }) => ({
  method: 'POST',
  path: '/company/{companyId}/members/coins',
  handler (request, reply) {
    const { kudosCoins, reason } = request.payload
    const userIds = request.payload.userIds.map((userId) => ObjectId(userId))
    const company = request.pre.company
    const { companyId } = request.params

    if (userIds.some((userId) => {
      return !company.members.some(({ user, active }) => user.equals(userId) && active)
    })) {
      return reply(Boom.forbidden('All userIds must be company members'))
    }

    db.users.findOne({ _id: ObjectId(request.auth.credentials) }, (err, moderator) => {
      if (err) return reply(err)

      const createdAt = new Date()
      const createdBy = {
        _id: moderator._id,
        avatar: moderator.avatar,
        firstName: moderator.firstName,
        lastName: moderator.lastName
      }

      // Chunk userIds into blocks of USER_ID_CHUNK_SIZE to avoid having too many user docs in memory at once
      const chunkedIds = userIds.reduce((groups, userId) => {
        if (groups[0].length < USER_ID_CHUNK_SIZE) {
          groups[0].push(userId)
        } else {
          groups.unshift([userId])
        }
        return groups
      }, [[]])

      Async.eachSeries(chunkedIds, (userIds, done) => {
        db.users.find({ _id: { $in: userIds } }, { _id: true, firstName: true, lastName: true, avatar: true, emails: true }, (err, users) => {
          if (err) return done(err)

          const bulkTransactions = db.transactionLogs.initializeUnorderedBulkOp()
          const emailTasks = []

          users.forEach(({ _id, firstName, lastName, avatar, emails }) => {
            bulkTransactions.insert({
              user: { _id, firstName, lastName, avatar },
              kudosCoins,
              createdAt,
              createdBy,
              reason,
              type: 'distribution',
              company: { _id: company._id },
              data: {}
            })

            const tplData = { firstName, kudosCoins, reason, companyId, createdBy }
            emailTasks.push((cb) => mailer.send('user-awarded-coins-notification', emails[0].address, tplData, cb))
          })

          bulkTransactions.execute(done)
          Async.parallelLimit(emailTasks, 25, (err) => console.error(err))
        })
      }, (err) => {
        if (err) return reply(err)

        db.users.update({ _id: { $in: userIds } }, { $inc: { kudosCoins } }, { multi: true }, (err) => {
          if (err) return reply(err)
          reply({
            userCount: userIds.length
          })
        })
      })
    })
  },
  config: {
    description: 'Distribute kudosCoins to company members',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      },
      payload: {
        userIds: Joi.array().items(Joi.objectId()).min(1).required(),
        kudosCoins: Joi.number().integer().greater(0).required(),
        reason: Joi.string().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})
