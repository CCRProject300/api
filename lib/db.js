const mongojs = require('mongojs')
const collections = [
  'dailyStats',
  'migrations',
  'users',
  'groups', // Legacy - please leave intact for migrations
  'companies',
  'leagues',
  'panels',
  'teams',
  'intervals',
  'tokens',
  'oldIntervals',
  'passwordTokens',
  'notifications',
  'shopItems',
  'transactionLogs',
  'charityBuckets'
]

module.exports = ({ mongo }) => mongojs(mongo, collections)
module.exports.collections = collections
