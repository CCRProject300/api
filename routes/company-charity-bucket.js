const Async = require('async')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')
const createCompanyMemberPre = require('./prerequisites/company-member')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')
const createUserRolePre = require('./prerequisites/user-role')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/charity/bucket/{bucketId}',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const bucketId = ObjectId(request.params.bucketId)
    const query = { _id: bucketId, 'company._id': companyId, deleted: false }

    db.charityBuckets.findOne(query, (err, bucket) => {
      if (err) return reply(err)
      if (!bucket) return reply(Boom.notFound('Charity bucket not found'))
      reply(bucket)
    })
  },
  config: {
    description: 'Get a single charity bucket',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        bucketId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyMemberPre({ db }),
      createUserRolePre({ db, role: 'charity-rewards' })
    ]
  }
})

module.exports.post = ({ db, uploadcare }) => ({
  method: 'POST',
  path: '/company/{companyId}/charity/bucket',
  handler (request, reply) {
    const bucketData = Object.assign({}, request.payload, {
      company: { _id: request.pre.company._id },
      total: 0,
      donations: [],
      deleted: false,
      createdAt: new Date()
    })

    db.charityBuckets.insert(bucketData, (err, bucket) => {
      if (err) return reply(err)
      uploadcare.store([bucketData.image, bucketData.logo])
      reply(bucket).code(201)
    })
  },
  config: {
    description: 'Create a new charity bucket',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      },
      payload: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string(),
        logo: Joi.string().uri(),
        image: Joi.string().uri(),
        target: Joi.number().integer().min(1).required(),
        autoClose: Joi.boolean().default(false),
        closed: Joi.boolean().default(false)
      }).required()
    },
    pre: [
      createCompanyModeratorPre({ db }),
      createUserRolePre({ db, role: 'charity-rewards' })
    ]
  }
})

module.exports.patch = ({ db, uploadcare }) => ({
  method: 'PATCH',
  path: '/company/{companyId}/charity/bucket/{bucketId}',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const bucketId = ObjectId(request.params.bucketId)
    const bucketData = request.payload

    Async.auto({
      bucket: (cb) => {
        const query = { _id: bucketId, 'company._id': companyId, deleted: false }
        db.charityBuckets.findOne(query, cb)
      },

      check: ['bucket', ({ bucket }, cb) => {
        if (!bucket) return cb(Boom.notFound('Charity bucket not found'))

        if (bucketData.target != null && bucketData.target !== bucket.target && bucketData.target <= bucket.total) {
          return cb(Boom.forbidden('Target must be greater than current total'))
        }

        cb()
      }],

      updateBucket: ['check', (_, cb) => {
        db.charityBuckets.update({ _id: bucketId }, { $set: bucketData }, cb)
      }],

      storeImages: ['updateBucket', ({ bucket }, cb) => {
        // If bucketData.image is null, remove the image, if undefined, no update
        if (bucketData.image !== undefined) {
          uploadcare.store(bucketData.image)
          uploadcare.remove(bucket.image)
        }
        if (bucketData.logo !== undefined) {
          uploadcare.store(bucketData.logo)
          uploadcare.remove(bucket.logo)
        }
        cb()
      }]
    }, (err, results) => {
      if (err) return reply(err)
      reply(Object.assign(results.bucket, bucketData))
    })
  },
  config: {
    description: 'Update a charity bucket',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        bucketId: Joi.objectId().required()
      },
      payload: Joi.object().keys({
        name: Joi.string(),
        description: Joi.string().allow(null),
        logo: Joi.string().uri().allow(null),
        image: Joi.string().uri().allow(null),
        target: Joi.number().integer().min(1),
        autoClose: Joi.boolean(),
        closed: Joi.boolean()
      }).required()
    },
    pre: [
      createCompanyModeratorPre({ db }),
      createUserRolePre({ db, role: 'charity-rewards' })
    ]
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/company/{companyId}/charity/bucket/{bucketId}',
  handler (request, reply) {
    const companyId = ObjectId(request.params.companyId)
    const bucketId = ObjectId(request.params.bucketId)

    Async.auto({
      bucket: (cb) => {
        const query = { _id: bucketId, 'company._id': companyId, deleted: false }
        db.charityBuckets.findOne(query, cb)
      },

      check: ['bucket', ({ bucket }, cb) => {
        if (!bucket) return cb(Boom.notFound('Charity bucket not found'))
        cb()
      }],

      updateBucket: ['check', (_, cb) => {
        db.charityBuckets.update({ _id: bucketId }, { $set: { deleted: true } }, cb)
      }]
    }, (err, results) => {
      if (err) return reply(err)
      reply().code(204)
    })
  },
  config: {
    description: 'Delete a charity bucket',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        bucketId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db }),
      createUserRolePre({ db, role: 'charity-rewards' })
    ]
  }
})
