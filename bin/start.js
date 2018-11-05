#!/usr/bin/env node

const config = require('config')
const createDb = require('../lib/db')
const createCachedCalc = require('../lib/cached-calc.js')
const createUploadcare = require('../lib/uploadcare')
const createMailer = require('../lib/mailer')
const createServer = require('../').createServer
const createCron = require('../lib/cron')
const createAuth0Api = require('../lib/auth0-api')

const db = createDb(config)
const cachedCalc = createCachedCalc()
const uploadcare = createUploadcare(config.uploadcare)
const mailer = createMailer(require('../emails'), config.email)
const cron = createCron({ db, mailer })
const auth0Api = createAuth0Api(config)

createServer({ db, cachedCalc, uploadcare, mailer, auth0Api, cron }, config, (err, ctx) => {
  if (err) throw err
  ctx.server.start(() => console.log(`Server running at: ${ctx.server.info.uri}`))
  cron.start()
})
