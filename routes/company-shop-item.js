const Async = require('async')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Boom = require('boom')
const createCompanyMemberPre = require('./prerequisites/company-member')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')
const createUserRolePre = require('./prerequisites/user-role')
const { hasRole } = require('../lib/roles')

module.exports.get = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/shop/item/{itemId}',
  handler (request, reply) {
    const userId = ObjectId(request.auth.credentials)
    const { company } = request.pre
    const itemId = ObjectId(request.params.itemId)

    Async.waterfall([
      (cb) => db.users.findOne({ _id: userId }, cb),
      (user, cb) => {
        const query = { _id: itemId, 'company._id': company._id, deleted: false }

        // Return ALL items for corporate_mod/admin, in-stock items for everyone else
        if (!hasRole(user, ['corporate_mod', 'admin'])) {
          query.stockLevel = { $gt: 0 }
        }

        db.shopItems.findOne(query, cb)
      }
    ], (err, item) => {
      if (err) return reply(err)
      if (!item) return reply(Boom.notFound('Item not found'))
      reply(item)
    })
  },
  config: {
    description: 'Get a single item in the company shop',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        itemId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyMemberPre({ db }),
      createUserRolePre({ db, role: 'rewards' })
    ]
  }
})

module.exports.post = ({ db, uploadcare }) => ({
  method: 'POST',
  path: '/company/{companyId}/shop/item',
  handler (request, reply) {
    const itemData = Object.assign({}, request.payload, {
      company: { _id: request.pre.company._id },
      deleted: false,
      createdAt: new Date()
    })

    db.shopItems.insert(itemData, (err, item) => {
      if (err) return reply(err)
      uploadcare.store(itemData.image)
      reply(item).code(201)
    })
  },
  config: {
    description: 'Create a new shop item',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      },
      payload: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string(),
        image: Joi.string().uri(),
        stockLevel: Joi.number().integer().min(0).required(),
        price: Joi.number().integer().min(0).required()
      }).required()
    },
    pre: [
      createCompanyModeratorPre({ db }),
      createUserRolePre({ db, role: 'rewards' })
    ]
  }
})

module.exports.patch = ({ db, uploadcare }) => ({
  method: 'PATCH',
  path: '/company/{companyId}/shop/item/{itemId}',
  handler (request, reply) {
    const { company } = request.pre
    const itemId = ObjectId(request.params.itemId)
    const itemData = request.payload

    Async.waterfall([
      function ensureExists (cb) {
        const query = { _id: itemId, 'company._id': company._id, deleted: false }

        db.shopItems.findOne(query, (err, item) => {
          if (err) return cb(err)
          if (!item) return cb(Boom.notFound('Item not found'))
          cb(null, item)
        })
      },
      function persistImage (item, cb) {
        // If itemData.image is null, remove the image, if undefined, no update
        if (itemData.image === undefined) return cb(null, item)

        uploadcare.store(itemData.image)
        uploadcare.remove(item.image)

        cb(null, item)
      },
      function updateItem (item, cb) {
        db.shopItems.update({ _id: item._id }, { $set: itemData }, (err) => {
          cb(err, Object.assign({}, item, itemData))
        })
      }
    ], reply)
  },
  config: {
    description: 'Update a shop item',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        itemId: Joi.objectId().required()
      },
      payload: Joi.object().keys({
        name: Joi.string(),
        description: Joi.string().allow(null),
        image: Joi.string().uri().allow(null),
        stockLevel: Joi.number().integer().min(0),
        price: Joi.number().integer().min(0)
      }).required()
    },
    pre: [
      createCompanyModeratorPre({ db }),
      createUserRolePre({ db, role: 'rewards' })
    ]
  }
})

module.exports.delete = ({ db }) => ({
  method: 'DELETE',
  path: '/company/{companyId}/shop/item/{itemId}',
  handler (request, reply) {
    const { company } = request.pre
    const itemId = ObjectId(request.params.itemId)

    Async.waterfall([
      function ensureExists (cb) {
        const query = { _id: itemId, 'company._id': company._id, deleted: false }
        db.shopItems.count(query, (err, exists) => {
          if (err) return cb(err)
          if (!exists) return cb(Boom.notFound('Item not found'))
          cb()
        })
      },
      function deleteItem (cb) {
        db.shopItems.update({ _id: itemId }, { $set: { deleted: true } }, cb)
      }
    ], (err) => {
      if (err) return reply(err)
      reply().code(204)
    })
  },
  config: {
    description: 'Delete a shop item',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        itemId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db }),
      createUserRolePre({ db, role: 'rewards' })
    ]
  }
})
