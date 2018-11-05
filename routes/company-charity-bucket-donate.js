const Async = require('async')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const createCompanyMemberPre = require('./prerequisites/company-member')
const { toUserRef } = require('../lib/user')
const userReply = require('../lib/user-reply')
const moment = require('moment')
const createUserRolePre = require('./prerequisites/user-role')

module.exports.post = ({ db, mailer }) => ({
  method: 'POST',
  path: '/company/{companyId}/charity/bucket/{bucketId}/donate',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const bucketId = ObjectId(request.params.bucketId)
    const { company } = request.pre
    const companyId = ObjectId(request.params.companyId)
    const { amount } = request.payload

    Async.auto({
      user: (cb) => db.users.findOne({ _id: userId }, cb),
      bucket: (cb) => {
        const query = { _id: bucketId, 'company._id': companyId, deleted: false }
        db.charityBuckets.findOne(query, cb)
      },
      company: (cb) => db.companies.findOne({ _id: companyId }, { name: 1 }, cb),

      check: ['user', 'bucket', 'company', ({ user, bucket, company }, cb) => {
        if (!bucket) {
          return cb(Boom.notFound('Charity bucket not found'))
        }

        if (bucket.closed) {
          return cb(Boom.forbidden('Charity bucket closed'))
        }

        if ((user.kudosCoins || 0) < amount) {
          return cb(Boom.forbidden('Insufficient credit'))
        }

        const maxAmount = bucket.target - bucket.total

        // Ensure donation won't take us over the target if autoClose is true
        if (bucket.autoClose && (amount > maxAmount)) {
          return cb(Boom.forbidden(`Maximum amount is ${maxAmount} KudosCoins`))
        }

        cb()
      }],

      insertTransactionLog: ['check', ({ user, bucket, company }, cb) => {
        db.transactionLogs.insert({
          user: toUserRef(user),
          company: { _id: companyId, name: company.name },
          kudosCoins: -amount,
          reason: `Donated ${amount} KudosCoins to ${bucket.name}`,
          type: 'donation',
          data: { bucket },
          createdBy: toUserRef(user),
          createdAt: new Date()
        }, cb)
      }],

      updateUser: ['check', ({ user }, cb) => {
        const query = { _id: userId }
        const update = { $inc: { kudosCoins: -amount } }
        db.users.findAndModify({ query, update, new: true }, (err, doc) => cb(err, doc))
      }],

      updateBucket: ['check', ({ user, bucket }, cb) => {
        const query = { _id: bucketId }

        const update = {
          $push: {
            donations: {
              user: toUserRef(user),
              amount,
              createdAt: new Date()
            }
          },
          $inc: { total: amount }
        }

        // Close the bucket if auto close is true and target reached
        if (bucket.autoClose && bucket.total + amount >= bucket.target) {
          update.$set = { closed: true }
        }

        db.charityBuckets.findAndModify({ query, update, new: true }, (err, doc) => cb(err, doc))
      }],

      sendReceiptEmail: ['insertTransactionLog', ({ user, insertTransactionLog }, cb) => {
        const transaction = insertTransactionLog
        const email = user.emails[0].address
        mailer.send('user-charity-bucket-donation-receipt', email, { transaction, moment })
        cb()
      }],

      sendUserTargetReachedEmails: ['updateBucket', ({ updateBucket }, cb) => {
        const bucket = updateBucket
        if (bucket.total < bucket.target) return cb()

        const query = { _id: { $in: bucket.donations.map((d) => d.user._id) } }

        db.users.find(query, { emails: 1 }, (err, users) => {
          if (err) return cb(err)
          const bcc = users.map((u) => u.emails[0].address)
          mailer.send('user-charity-bucket-target-reached', [], { bucket, bcc })
          cb()
        })
      }],

      sendModeratorTargetReachedEmails: ['updateBucket', ({ updateBucket }, cb) => {
        const bucket = updateBucket
        if (bucket.total < bucket.target) return cb()

        const query = { _id: { $in: company.moderators.map((m) => m.user) } }

        db.users.find(query, { emails: 1 }, (err, users) => {
          if (err) return cb(err)
          const bcc = users.map((u) => u.emails[0].address)
          mailer.send('moderator-charity-bucket-target-reached', [], { bucket, bcc })
          cb()
        })
      }],

      userReply: ['updateUser', ({ updateUser }, cb) => {
        userReply({ db, user: updateUser }, cb)
      }]
    }, (err, results) => {
      if (err) return reply(err)
      reply({ user: results.userReply, bucket: results.updateBucket })
    })
  },
  config: {
    description: 'Donate to a charity bucket using KudosCoins',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        bucketId: Joi.objectId().required()
      },
      payload: Joi.object().keys({
        amount: Joi.number().integer().min(1).required()
      }).required()
    },
    pre: [
      createCompanyMemberPre({ db }),
      createUserRolePre({ db, role: 'charity-rewards' })
    ]
  }
})
