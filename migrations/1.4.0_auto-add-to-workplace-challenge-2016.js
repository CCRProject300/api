const ObjectId = require('mongojs').ObjectId
const Async = require('async')

const LEAGUE_IDS = [
  '57d189266a8971625e392aa0',
  '57d18da96a8971625e392ab8',
  '57d18f9b6a8971625e392acc',
  '57d190f76a8971625e392adb',
  '57d189d86a8971625e392aa5',
  '57d199006a8971625e392afa',
  '57d199966a8971625e392aff',
  '57d2a3f86a8971625e392c5e',
  '57d288a96a8971625e392c12',
  '57d2cbff6a8971625e392cb5',
  '57d2d9056a8971625e392ce2',
  '57d2d9896a8971625e392ce4',
  '57d3f9f36a8971625e392d17',
  '57d3faf56a8971625e392d1b',
  '57d2a1cc6a8971625e392c55',
  '57d7f3e6518ea17433eb37b1',
  '57d3fa8e6a8971625e392d19',
  '57d27c486a8971625e392bda',
  '57d18e046a8971625e392abb'
].map((id) => ObjectId(id))

function autoAddMembers (db, league, cb) {
  // Even if they declined or didn't respond yet...
  const members = (league.members || []).map((m) => {
    m.active = true
    m.activated = true
    return m
  })

  const query = { _id: league._id }
  const update = { $set: { members } }
  db.groups.update(query, update, cb)
}

function autoRedeemNotifications (db, league, cb) {
  const query = { 'group._id': league._id, redeemedAt: null }
  const update = { $set: { redeemedAt: new Date() } }
  db.notifications.update(query, update, { multi: true }, cb)
}

module.exports = function (cb) {
  const db = this.db

  const query = { __t: 'League', _id: { $in: LEAGUE_IDS } }
  db.groups.find(query, (err, leagues) => {
    if (err) return cb(err)

    Async.each(leagues, (league, cb) => {
      Async.parallel([
        (cb) => autoAddMembers(db, league, cb),
        (cb) => autoRedeemNotifications(db, league, cb)
      ], cb)
    }, cb)
  })
}
