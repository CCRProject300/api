const Async = require('async')

const GroupCollectionMap = {
  Company: 'companies',
  League: 'leagues',
  Panel: 'panels',
  Team: 'teams'
}

module.exports = function (cb) {
  const db = this.db
  const LIMIT = 100

  // Count groups for batching into LIMIT sized chunks
  db.groups.count({}, (err, total) => {
    if (err) return cb(err)

    const batches = []

    for (let i = 0; i < total; i += LIMIT) {
      batches.push(i)
    }

    console.log(`Migrating ${total} groups in ${batches.length} batches of ${LIMIT}`)

    Async.each(batches, (skip, cb) => {
      console.log(`Migrating groups ${skip}..${Math.min(skip + LIMIT, total) - 1}`)

      // Find the groups in this batch
      db.groups
        .find({})
        .sort({ name: 1 })
        .limit(LIMIT)
        .skip(skip, (err, groups) => {
          if (err) return cb(err)

          const counts = groups.reduce((counts, group) => {
            counts[group.__t] = (counts[group.__t] || 0) + 1
            return counts
          }, {})

          console.log(Object.keys(counts).map((t) => `${counts[t]} ${t}(s)`))

          // Insert each group into the appropriate collection
          Async.each(groups, (group, cb) => {
            const doc = Object.assign({}, group)
            delete doc.__t
            db[GroupCollectionMap[group.__t]].insert(doc, cb)
          }, cb)
        })
    }, cb)
  })
}
