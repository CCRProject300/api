const Joi = require('joi')
const moment = require('moment')

const paramSchema = {
  endDate: Joi.date().max('now').required(),
  startDate: Joi.date().max(Joi.ref('endDate')).required(),
  groupId: Joi.string().required(),
  label: Joi.string()
}

module.exports = function () {
  var cache = []
  var lastPurgeDate

  function purgeCache () {
    const startOfToday = moment.utc().startOf('day').valueOf()
    if (lastPurgeDate === startOfToday) return
    cache = []
    lastPurgeDate = startOfToday
  }

  function addStat (stat) {
    purgeCache()
    cache.push(stat)
    return stat
  }

  // params should be
  // {
  //  groupId,
  //  startDate,
  //  endDate,
  //  label (optional)
  // }
  function cachedCalc (params, calcFunc, cb) {
    const storedParams = Object.keys(params).reduce((memo, key) => {
      if (key in paramSchema) memo[key] = params[key]
      return memo
    }, {})
    const validation = Joi.validate(storedParams, paramSchema)
    if (validation.error) throw new Error(validation.error)

    storedParams.startDate = moment.utc(storedParams.startDate).startOf('day')
    storedParams.endDate = moment.utc(storedParams.endDate).startOf('day')
    const stat = cache.find((stat) => !Object.keys(storedParams).some((key) => {
      return storedParams[key].valueOf() !== (stat[key] && stat[key].valueOf())
    }))
    if (stat) {
      return setImmediate(cb.bind(null, null, stat.value))
    }

    calcFunc(params, (err, stat) => {
      if (err) return cb(err)
      const newStat = Object.assign({}, storedParams, { value: stat })
      addStat(newStat)
      cb(null, stat)
    })
  }

  return cachedCalc
}
