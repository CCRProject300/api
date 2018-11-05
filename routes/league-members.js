const Boom = require('boom')
const Joi = require('joi')
Joi.objectId = require('joi-objectid')(Joi)
const ObjectId = require('mongojs').ObjectId
const Async = require('async')
const actions = require('../lib/actions')
const createLeagueModeratorPre = require('./prerequisites/league-moderator')
const addNewLeagueMemberNotifications = require('../lib/add-new-league-member-notifications')
const addNewLeagueMemberDirectlyNotifications = require('../lib/add-new-league-member-directly-notifications')

module.exports.add = ({ db, mailer }) => ({
  method: 'POST',
  path: '/league/{leagueId}/members',
  handler (request, reply) {
    const league = request.pre.league
    const existingMembers = league.members || []

    const userIds = request.payload.users.filter((id) => {
      return !existingMembers.some((m) => m.user.toString() === id.toString())
    })
    const panelId = request.payload.panelId && new ObjectId(request.payload.panelId)

    if (league.teamSize > 1 && !panelId) return reply(Boom.badRequest('You must supply a panelId to add users to a group league'))

    if (!userIds.length) {
      return getLeagueMembersReply(db, league, (err, members) => {
        if (err) return reply(err)
        reply(members)
      })
    }

    const members = userIds.map((id) => ({
      user: ObjectId(id),
      startDate: new Date(),
      active: true,
      activated: true
    }))

    Async.waterfall([
      function addUsersToTeams (cb) {
        const { joinGroupLeague, joinIndividualLeague } = actions(db)

        if (panelId) {
          // We need to do this one at a time to fill up teams properly
          return Async.eachSeries(userIds, (userId, done) => {
            joinGroupLeague({ userId: new ObjectId(userId), leagueId: league._id, panelId, confirm: true }, done)
          }, cb)
        }

        Async.each(userIds, (userId, done) => {
          joinIndividualLeague({ userId: new ObjectId(userId), leagueId: league._id, confirm: true }, done)
        }, cb)
      },
      function addNotifications (cb) {
        addNewLeagueMemberDirectlyNotifications({ db, mailer, league, userIds, panelId }, cb)
      },
      function getMembersForResponse (cb) {
        league.members = existingMembers.concat(members)
        getLeagueMembersReply(db, league, cb)
      }
    ], (err, members) => {
      if (err) return reply(err)
      reply(members)
    })
  },
  config: {
    description: 'Add new league members(s)',
    auth: 'auth0',
    validate: {
      params: {
        leagueId: Joi.objectId().required()
      },
      payload: {
        users: Joi.array().items(Joi.objectId()).min(1).required(),
        panelId: Joi.objectId()
      }
    },
    pre: [
      createLeagueModeratorPre({ db })
    ]
  }
})

module.exports.invite = ({ db, mailer }) => ({
  method: 'POST',
  path: '/league/{leagueId}/members/invite',
  handler (request, reply) {
    const league = request.pre.league
    const existingMembers = league.members || []

    const userIds = request.payload.users.filter((id) => {
      return !existingMembers.some((m) => m.user.toString() === id.toString())
    })

    if (!userIds.length) {
      return getLeagueMembersReply(db, league, (err, members) => {
        if (err) return reply(err)
        reply(members)
      })
    }

    const members = userIds.map((id) => ({
      user: ObjectId(id),
      active: true,
      activated: false
    }))

    const update = { $push: { members: { $each: members } } }

    Async.waterfall([
      function addNotifications (cb) {
        addNewLeagueMemberNotifications({ db, mailer, league, userIds }, cb)
      },
      function updateLeague (cb) {
        db.leagues.update({ _id: league._id }, update, cb)
      },
      function getMembersForResponse (_, cb) {
        league.members = existingMembers.concat(members)
        getLeagueMembersReply(db, league, cb)
      }
    ], (err, members) => {
      if (err) return reply(err)
      reply(members)
    })
  },
  config: {
    description: 'Invite new league members(s)',
    auth: 'auth0',
    validate: {
      params: {
        leagueId: Joi.objectId().required()
      },
      payload: {
        users: Joi.array().items(Joi.objectId()).min(1).required()
      }
    },
    pre: [
      createLeagueModeratorPre({ db })
    ]
  }
})

function getLeagueMembersReply (db, league, cb) {
  const userIds = (league.members || []).map((m) => m.user)

  const query = { _id: { $in: userIds } }
  const fields = { firstName: 1, lastName: 1 }

  db.users.find(query, fields, (err, users) => {
    if (err) return cb(err)

    const getUserName = (id) => {
      const user = users.find((u) => u._id.toString() === id.toString())
      if (!user) return {}
      if (!user.lastName) return { firstName: user.firstName }
      if (!user.firstName) return { lastName: user.lastName }
      return { firstName: user.firstName, lastName: user.lastName }
    }

    const members = (league.members || []).map((m) => Object.assign({
      _id: m.user,
      activated: m.activated,
      startDate: m.startDate
    }, getUserName(m.user)))

    cb(null, members)
  })
}
