#!/usr/bin/env node

const config = require('config')
const createDb = require('../lib/db')
const createMailer = require('../lib/mailer')
const db = createDb(config)
const mailer = createMailer(require('../emails'), config.email)
const tasks = require('../lib/cron-tasks')
const task = process.argv[2]

tasks[task]({ db, mailer }, function (err) {
  console.log(`Done completed ${task} with ${(err && err.message) || 'no errors'}`)
  db.close(function (err) {
    if (err) return process.exit(1)
    process.exit(0)
  })
})
