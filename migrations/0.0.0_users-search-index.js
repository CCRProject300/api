module.exports = function (cb) {
  var db = this.db

  db.users.createIndex({
    'firstName': 'text',
    'lastName': 'text',
    'companyName': 'text'
  }, {
    weights: {
      'firstName': 5,
      'lastName': 5,
      'companyName': 2
    },
    name: 'UsersSearchIndex'
  }, cb)
}
