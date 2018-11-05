const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const Async = require('async')
const Boom = require('boom')
const createCompanyModeratorPre = require('./prerequisites/company-moderator')
const companyReply = require('../lib/company-reply')

module.exports.getTokens = ({ db }) => ({
  method: 'GET',
  path: '/company/{companyId}/tokens',
  handler (request, reply) {
    const company = request.pre.company

    db.tokens.find({
      companyId: company._id,
      revoked: false
    }, (err, tokens) => {
      if (err) return reply(err)
      reply(JSON.stringify(tokens.map((token) => token._id.toString()))).code(201)
    })
  },
  config: {
    description: 'Get live invite tokens for a company',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})

module.exports.post = ({ db }) => ({
  method: 'POST',
  path: '/company/{companyId}/token',
  handler (request, reply) {
    const company = request.pre.company
    const token = {
      companyId: company._id,
      revoked: false
    }

    db.tokens.insert(token, (err, token) => {
      if (err) return reply(err)
      reply(JSON.stringify({ token: token._id.toString() })).code(201)
    })
  },
  config: {
    description: 'Create a new company league',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})

module.exports.revoke = ({ db }) => ({
  method: 'PATCH',
  path: '/company/{companyId}/token/{tokenId}',
  handler (request, reply) {
    const tokenId = ObjectId(request.params.tokenId)
    const company = request.pre.company

    db.tokens.update({ _id: tokenId, companyId: company._id }, { $set: { revoked: true } }, (err, res) => {
      if (err) return reply(err)
      if (!res) return reply(Boom.notFound('Token not found'))
      reply(JSON.stringify({ token: tokenId.toString() })).code(200)
    })
  },
  config: {
    description: 'Create a new company league',
    auth: 'auth0',
    validate: {
      params: {
        companyId: Joi.objectId().required(),
        tokenId: Joi.objectId().required()
      }
    },
    pre: [
      createCompanyModeratorPre({ db })
    ]
  }
})

module.exports.getCompany = ({ db }) => ({
  method: 'GET',
  path: '/token/{tokenId}/company',
  handler (request, reply) {
    const tokenId = ObjectId(request.params.tokenId)
    Async.waterfall([
      function getToken (cb) {
        db.tokens.findOne({
          _id: tokenId,
          revoked: false
        }, cb)
      },
      function getCompany (token, cb) {
        if (!token) return reply(Boom.notFound('Token revoked or unrecognised'))

        db.companies.findOne({
          _id: token.companyId,
          deleted: false
        }, cb)
      }
    ], (err, company) => {
      if (err) return reply(err)
      if (!company) return reply(Boom.notFound('That company has been deleted'))
      reply(companyReply(company))
    })
  },
  config: {
    description: 'Validate an invite token and get the associated company',
    auth: false,
    validate: {
      params: {
        tokenId: Joi.objectId().required()
      }
    }
  }
})
