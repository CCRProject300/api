const Async = require('async')
const ObjectId = require('mongojs').ObjectId
const addNewLeagueMemberNotifications = require('../lib/add-new-league-member-notifications')

module.exports = function (cb) {
  const db = this.db

  Async.parallel([
    function addLeagueNotifications (done) {
      db.groups.aggregate([
        { $match: { __t: 'League', deleted: false } },
        { $unwind: '$members' },
        { $match: { 'members.activated': false } },
        { $group: { _id: '$_id', league: { $first: '$$ROOT' }, userIds: { $push: '$members.user' } } }
      ], (err, res) => {
        if (err) return done(err)

        Async.each(res, (data, cb) => {
          addNewLeagueMemberNotifications({ db, league: data.league, userIds: data.userIds }, cb)
        }, done)
      })
    },

    function addCorpModNotifications (done) {
      db.groups.aggregate([
        { $match: { __t: 'Company', deleted: false } },
        { $unwind: '$moderators' },
        { $match: { 'moderators.activated': false } },
        { $group: { _id: '$_id', company: { $first: '$$ROOT' }, userIds: { $push: '$moderators.user' } } }
      ], (err, res) => {
        if (err) return done(err)

        Async.each(res, (data, cb) => {
          const notification = {
            type: 'corpModInvite',
            group: { _id: data.company._id, name: data.company.name },
            messages: ['You have been invited to be a moderator for the company ', 'Do you want to accept?'],
            deleted: false
          }
          const bulkNotificationOp = db.notifications.initializeUnorderedBulkOp()

          data.userIds.forEach((userId) => {
            bulkNotificationOp.find({
              'user._id': ObjectId(userId),
              'group._id': data.company._id,
              type: 'corpModInvite'
            }).upsert().replaceOne(Object.assign({ user: { _id: ObjectId(userId) } }, notification))
          })
          bulkNotificationOp.execute((err) => {
            if (err) return cb(err)
            cb()
          })
        }, done)
      })
    },

    function addCompanyNotifications (done) {
      db.groups.aggregate([
        { $match: { __t: 'Company', deleted: false } },
        { $unwind: '$members' },
        { $match: { 'members.activated': false } },
        { $group: { _id: '$_id', company: { $first: '$$ROOT' }, userIds: { $push: '$members.user' } } }
      ], (err, res) => {
        if (err) return done(err)

        Async.each(res, (data, cb) => {
          const notification = {
            type: 'companyInvite',
            group: { _id: data.company._id, name: data.company.name },
            messages: ['You have been invited to join the company ', 'Do you want to accept?'],
            deleted: false
          }
          const bulkNotificationOp = db.notifications.initializeUnorderedBulkOp()
          data.userIds.forEach((userId) => {
            bulkNotificationOp.find({
              'user._id': ObjectId(userId),
              'group._id': data.company._id,
              type: 'companyInvite'
            }).upsert().replaceOne(Object.assign({ user: { _id: ObjectId(userId) } }, notification))
          })
          bulkNotificationOp.execute((err) => {
            if (err) return cb(err)
            cb()
          })
        }, done)
      })
    }
  ], cb)
}
