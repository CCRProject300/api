const ok = (_, cb) => { if (cb) process.nextTick(() => cb()) }
module.exports = () => ({ store: ok, remove: ok })
