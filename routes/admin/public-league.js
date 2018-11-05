const ObjectId = require('mongojs').ObjectId
const Joi = require('joi')
const Boom = require('boom')
const Async = require('async')
Joi.objectId = require('joi-objectid')(Joi)
const moment = require('moment')
const createUserRolePre = require('../prerequisites/user-role')

module.exports.post = ({ db, uploadcare }) => ({
  method: 'POST',
  path: '/admin/league',
  handler (request, reply) {
    const { payload, auth } = request
    const user = {
      user: ObjectId(auth.credentials),
      activated: true,
      active: true,
      startDate: moment.utc().toISOString()
    }
    const insert = Object.assign({
      _id: new ObjectId(),
      public: true,
      leagueType: 'public',
      moderators: [user],
      members: [],
      deleted: false,
      panel: [],
      teamSize: null
    }, payload)

    if (insert.startDate) {
      insert.startDate = moment.utc(insert.startDate).toISOString()
    }
    if (insert.endDate) {
      insert.endDate = moment.utc(insert.endDate).toISOString()
    }

    db.leagues.insert(insert, (err, league) => {
      if (err) return reply(err)
      const { logo, heroImage } = league.branding || {}
      uploadcare.store([logo, heroImage])
      reply(league).code(201)
    })
  },
  config: {
    description: 'Create a new public league, returns the league',
    auth: 'auth0',
    validate: {
      payload: {
        name: Joi.string().required(),
        description: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        teamSize: Joi.number().allow(null),
        minTeamSize: Joi.number().min(1).required(),
        branding: Joi.object().keys({
          logo: Joi.string().uri().required(),
          heroImage: Joi.string().uri().required(),
          title: Joi.string().required(),
          body: Joi.string().required()
        })
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.patch = ({ db, uploadcare }) => ({
  method: 'PATCH',
  path: '/admin/league/{leagueId}',
  handler (request, reply) {
    const { payload, params } = request
    const _id = ObjectId(params.leagueId)

    Async.waterfall([
      (cb) => db.leagues.findOne({ _id }, cb),
      (originalLeague, cb) => {
        if (!originalLeague) return cb(Boom.notFound())
        db.leagues.findAndModify({
          query: { _id },
          update: {$set: payload},
          new: true
        }, (err, updatedLeague) => cb(err, originalLeague, updatedLeague))
      },
      (originalLeague, updatedLeague, cb) => {
        if (!updatedLeague.branding) return cb(null, updatedLeague)

        // update images on uploadcare
        ;['logo', 'heroImage'].forEach((image) => {
          if (!updatedLeague.branding[image]) return
          if (originalLeague.branding[image] === updatedLeague.branding[image]) return

          uploadcare.store(updatedLeague.branding[image])
          uploadcare.remove(originalLeague.branding[image])
        })

        cb(null, updatedLeague)
      }
    ], (err, updatedLeague) => {
      if (err) return reply(Boom.wrap(err))
      return reply(updatedLeague)
    })
  },
  config: {
    description: 'Update a public league, returns the updated league',
    auth: 'auth0',
    validate: {
      params: {
        leagueId: Joi.objectId().required()
      },
      payload: {
        name: Joi.string(),
        description: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        branding: Joi.object().keys({
          logo: Joi.string().uri(),
          heroImage: Joi.string().uri(),
          title: Joi.string(),
          body: Joi.string()
        })
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})

module.exports.delete = ({ db, uploadcare }) => ({
  method: 'DELETE',
  path: '/admin/league/{leagueId}',
  handler (request, reply) {
    const _id = ObjectId(request.params.leagueId)
    db.leagues.findAndModify({
      query: { _id },
      update: {$set: {deleted: true}},
      new: true
    }, (err, deletedLeague) => {
      if (err) return reply(Boom.wrap(err))
      if (!deletedLeague) return reply(Boom.notFound())
      const { logo, heroImage } = deletedLeague.branding || {}
      uploadcare.remove([logo, heroImage])
      reply(deletedLeague._id)
    })
  },
  config: {
    description: 'Delete a public league, returns the deleted leagueId',
    auth: 'auth0',
    validate: {
      params: {
        leagueId: Joi.objectId().required()
      }
    },
    pre: [
      createUserRolePre({ db, role: 'admin' })
    ]
  }
})
