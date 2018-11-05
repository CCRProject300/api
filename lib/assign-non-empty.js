module.exports = (mapping, source = {}, dest = {}) => {
  Object.keys(mapping).forEach((sourceKey, i) => {
    let destKey = mapping[sourceKey]

    if (Object.prototype.toString.call(destKey) === '[object String]') {
      destKey = { key: destKey, val: (v) => v }
    }

    const val = destKey.val(source[sourceKey])

    if (val != null && val !== '') {
      dest[destKey.key] = val
    }
  })
  return dest
}
