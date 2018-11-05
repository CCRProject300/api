const config = require('config')
const Async = require('async')
const createDb = require('../../lib/db')
const createMailer = require('../../lib/mailer')
const { createServer } = require('../../')

let context = null

const create = (opts, cb) => {
  if (!cb) {
    cb = opts
    opts = {}
  }

  opts = opts || {}

  const db = opts.db || createDb(config)
  const mailer = opts.mailer || createMailer(require('../../emails'), config.email)
  const uploadcare = opts.uploadcare || require('./mock-uploadcare')()
  const auth0Api = opts.auth0Api || require('./mock-auth0-api')

  createServer({ db, mailer, uploadcare, auth0Api }, config, cb)
}

module.exports.create = create

module.exports.start = (opts, cb) => {
  if (!cb) {
    cb = opts
    opts = {}
  }

  create(opts, (err, ctx) => {
    if (err) return cb(err)
    context = ctx
    ctx.server.start(() => cb(null, ctx))
  })
}

module.exports.stop = (cb) => {
  const ctx = context
  context = null

  if (!ctx) return process.nextTick(() => cb())

  Async.parallel([
    (cb) => ctx.server.stop(cb),
    (cb) => ctx.db.close(true, cb)
  ], cb)
}

// Create a server and append the ctx to the arg list for fn
module.exports.withServer = function (opts, fn) {
  if (!fn) {
    fn = opts
    opts = {}
  }

  return function () {
    const args = Array.from(arguments)
    create(opts, (err, ctx) => {
      if (err) throw err
      fn.apply(this, args.concat(ctx))
    })
  }
}
