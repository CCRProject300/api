const pick = require('lodash.pick')

module.exports = (team, league, userId) => {
  let payload = pick(team, [
    'name',
    'description',
    'startDate',
    'endDate',
    'panel'
  ])
  payload._id = team._id.toString()
  payload.memberCount = team.members ? team.members.length : 0

  if (team.members.some((m) => m.user.equals(userId))) payload.member = true

  if (league) {
    payload.league = {
      _id: league._id.toString(),
      name: league.name
    }

    if (userId && (league.moderators || []).some((m) => m.user.toString() === userId.toString())) {
      payload.moderator = true
    }

    if (userId && (team.members || []).some((m) => m.user.toString() === userId.toString())) {
      payload.member = true
    }
  }

  return payload
}
