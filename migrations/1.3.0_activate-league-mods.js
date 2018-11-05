module.exports = function (cb) {
  const db = this.db
  const query = {
    __t: 'League',
    moderators: {
      $elemMatch: {
        activated: false,
        startDate: { $lt: new Date('2016-09-13') }
      }
    }
  }
  const update = { $set: { 'moderators.$.activated': true } }
  db.groups.update(query, update, { multi: true }, cb)
}
