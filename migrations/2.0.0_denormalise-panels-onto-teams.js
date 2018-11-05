// Denormalise basic panel details onto teams so that this detail is available even when team names are changed
const Async = require('async')

module.exports = function (cb) {
  this.db.groups.find({ __t: 'Panel', deleted: false }, (err, panels) => {
    if (err) return cb(err)
    Async.eachLimit(panels, 10, (p, done) => {
      const panel = { _id: p._id, name: p.name }
      const teamIds = (p.team || []).map((t) => t.teamId)
      this.db.groups.update({ __t: 'Team', _id: { $in: teamIds } }, { $set: { panel } }, { multi: true }, done)
    }, cb)
  })
}
