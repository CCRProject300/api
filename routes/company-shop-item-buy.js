const Async = require('async')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Boom = require('boom')
const ObjectId = require('mongojs').ObjectId
const createCompanyMemberPre = require('./prerequisites/company-member')
const createUserRolePre = require('./prerequisites/user-role')
const userReply = require('../lib/user-reply')
const moment = require('moment')

module.exports.post = ({ db, mailer }) => ({
  method: 'POST',
  path: '/company/{companyId}/shop/item/{itemId}/buy',
  handler (request, reply) {
    const _userId = ObjectId(request.auth.credentials)
    const _itemId = ObjectId(request.params.itemId)
    const _companyId = ObjectId(request.params.companyId)

    Async.waterfall([
      function getUserAndItem (cb) {
        Async.parallel({
          user: (done) => db.users.findOne({ _id: _userId }, done),
          item: (done) => db.shopItems.findOne({ _id: _itemId, 'company._id': _companyId, deleted: false }, done),
          company: (done) => db.companies.findOne({ _id: _companyId }, {name: 1}, done)
        }, cb)
      },

      function checkAndPurchaseItem ({ user, item, company }, cb) {
        if (!item) return cb(Boom.notFound('Item not found'))
        if (item.stockLevel <= 0) return cb(Boom.conflict('Item is out of stock'))
        if ((user.kudosCoins || 0) < item.price) return cb(Boom.forbidden('User does not have enough credit'))

        const transaction = {
          user: { _id: user._id, avatar: user.avatar, firstName: user.firstName, lastName: user.lastName },
          kudosCoins: -item.price,
          createdAt: new Date(),
          createdBy: { _id: user._id, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar },
          company: {
            _id: _companyId,
            name: company.name
          },
          reason: `purchase 1 ${item.name} for ${item.price}KCs`,
          type: 'purchase',
          data: {
            item
          }
        }

        Async.parallel({
          item: (done) => db.shopItems.update({ _id: _itemId }, { $inc: { stockLevel: -1 } }, done),
          user: (done) => {
            db.users.findAndModify({
              query: { _id: _userId },
              update: { $inc: { kudosCoins: -item.price } },
              new: true
            }, done)
          },
          transaction: (done) => db.transactionLogs.insert(transaction, done)
        }, function (err, result) {
          if (err) return cb(err)

          const { transaction, user } = result
          const email = user[0].emails[0].address

          mailer.send('user-shop-purchase-receipt', email, { transaction, moment })

          cb()
        })
      },

      function findUpdatedDocs (cb) {
        Async.parallel({
          item: (cb) => db.shopItems.findOne({ _id: _itemId }, cb),
          user: (cb) => {
            db.users.findOne({ _id: _userId }, (err, user) => {
              if (err) return cb(err)
              userReply({ db, user }, cb)
            })
          }
        }, cb)
      }
    ], reply)
  },
  config: {
    description: 'Purchase an item using KudosCoins',
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
