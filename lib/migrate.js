const Path = require('path')
const omg = require('ohmigrate')

module.exports = (db, cb) => {
  omg({
    // Should I run migration called `name`?
    // Callback `cb` with true/false to begin
    should (name, cb) {
      db.migrations.count({ name }, (err, exists) => {
        if (err) return cb(err)
        if (exists) console.log(`Skipping completed migration ${name}`)
        cb(null, !exists)
      })
    },
    // Migration called `name` ran successfully
    // Next migration doesn't start until you call `cb`
    did (name, cb) {
      db.migrations.save({ name }, (err) => {
        if (err) return cb(err)
        console.log(`Migration completed successfully ${name}`)
        cb()
      })
    },
    // All migrations ran successfully, or an error occurred
    done: cb,
    // Path to the directory where migrations can be found
    dir: Path.join(__dirname, '..', 'migrations'),
    // Context (this) in migration functions
    ctx: { db }
  })
}
