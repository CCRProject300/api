const Url = require('url')
const Async = require('async')
const createUploadcare = require('uploadcare')

function uuidFromUrl (uploadcareUrl) {
  if (!uploadcareUrl) return null
  const url = Url.parse(uploadcareUrl)
  if (url.hostname !== 'ucarecdn.com' || !url.pathname) return null
  return url.pathname.split('/')[1]
}

const noop = (err) => { if (err) console.error(err) }

// Store/remove multiple images with/without callback
function updateImages (client, op, urls, cb) {
  urls = Array.isArray(urls) ? urls : [urls]
  cb = cb || noop
  Async.each(urls, (url, cb) => {
    const uuid = uuidFromUrl(url)
    if (!uuid) return cb()
    client.files[op](uuid, cb)
  }, (err) => cb(err))
}

module.exports = (uploadcareConfig) => {
  const client = createUploadcare(uploadcareConfig.publicKey, uploadcareConfig.secretKey)
  return {
    uuidFromUrl,
    store: updateImages.bind(null, client, 'store'),
    remove: updateImages.bind(null, client, 'remove')
  }
}
