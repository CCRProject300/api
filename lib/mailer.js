const nodemailer = require('nodemailer')
const stubTransport = require('nodemailer-stub-transport')
const htmlToText = require('nodemailer-html-to-text').htmlToText
const inlineBase64 = require('nodemailer-plugin-inline-base64')

const noop = (err) => { if (err) console.error(err) }

module.exports = function createMailer (templates, opts) {
  opts = opts || {}
  opts.defaultFrom = opts.defaultFrom || 'noreply@kudoshealth.com'

  const transport = nodemailer.createTransport(opts.transport || stubTransport())
  transport.use('compile', inlineBase64())
  transport.use('compile', htmlToText())

  return {
    send (id, recipients, data, cb) {
      cb = cb || noop

      const template = templates[id]

      if (!template) {
        return process.nextTick(() => cb(new Error(`Unknown template ${id}`)))
      }

      const transportOpts = {
        from: template.from ? template.from(data) : opts.defaultFrom,
        to: recipients,
        cc: data.cc,
        bcc: data.bcc,
        subject: template.subject(data, opts),
        html: template.body(data),
        attachments: data.attachments || []
      }

      // If no configured transport, log out what the stub will send
      if (!opts.transport) {
        console.log(transportOpts)
      }

      transport.sendMail(transportOpts, cb)
    }
  }
}
