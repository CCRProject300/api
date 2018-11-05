const test = require('tape')
const Async = require('async')
const { withServer } = require('./helpers/server')
const clearDb = require('./helpers/clear-db')
const addUser = require('./helpers/add-user')
const addCompany = require('./helpers/add-company')
const moment = require('moment')
const averageWeeklyCoins = require('../lib/average-weekly-coins')
const fakeTransactionLog = require('./helpers/fake-transaction-log')

test('should be able to calculate avgerage coins users earn through kudosPoints', withServer((t, { server, db }) => {
  Async.waterfall([
    (cb) => clearDb(db, cb),
    (cb) => Async.parallel([
      addUser.bind(addUser, db),
      addUser.bind(addUser, db)
    ], cb),
    (users, cb) => addCompany(db, { users }, (err, company) => {
      cb(err, { users, company })
    }),
    ({ users, company }, cb) => {
      const bulk = db.transactionLogs.initializeUnorderedBulkOp()

      const lastSaturday = moment.utc().days(0).subtract(1, 'days')

      users.forEach((user, userIndex) => {
        // user1 has 5 coins a day -> 35 coins a week
        // user2 has 7 coins a day -> 49 coins a week
        const coins = 5 + (userIndex * 2)
        const nineWeeksInDays = 64

        Array(nineWeeksInDays).fill(0).map((n, index) => {
          const startDate = moment.utc(lastSaturday).subtract(index, 'days').toDate()
          const startOfDay = moment.utc(startDate).startOf('day')
          const { firstName, lastName, avatar, _id } = user

          const transaction = fakeTransactionLog({
            user: { firstName, lastName, avatar, _id },
            company: { _id: company._id, name: company.name },
            type: 'activity',
            createdBy: { firstName, lastName, avatar, _id },
            reason: `Earned from some KPs on ${moment.utc(startOfDay).format('ll')}`,
            kudosCoins: coins,
            createdAt: moment(startDate).toDate(),
            data: {
              startOfDay: moment(startOfDay).unix()
            }
          })

          bulk.insert(transaction)
        })
      })

      bulk.execute(err => cb(err, company))
    },
    (company, cb) => {
      averageWeeklyCoins(db, company, cb)
    }
  ], (err, result) => {
    t.ifError(err, 'No error')
    t.equal(result, 42)
    db.close()
    t.end()
  })
}))
