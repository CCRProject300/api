const moment = require('moment')
const uniq = require('lodash.uniq')
const config = require('config')

const msInDay = 24 * 60 * 60 * 1000

function getStartAndEnd (period, dateish) {
  const start = moment(dateish).utc().startOf(period).valueOf()
  const end = moment(dateish).utc().endOf(period).valueOf()
  return { start, end }
}

/*
  Format the data ready for graphing. Group the values by activity name.
  (...) => ({
    labels: ['Jan', 'Feb'],
    series: [
      [{value: 0.2, meta: 'Activity'}, {value: 0.1, meta: 'Activity'}]
      [{value: 0.9, meta: 'Frisbee'}, 0]
      [{value: 0.2, meta: 'Cycling'}, 0]
    ]
  })
*/
function graphFormat ({ start, end, intervalSize, data, field, timeFormat }) {
  const labels = []
  const activityNames = uniq(data.map((interval) => {
    return (interval.types && interval.types[0]) || 'Activity'
  })).sort()
  const seriesLength = Math.floor((end - start) / intervalSize)
  // init the data points to all 0's
  const series = Array(activityNames.length).fill(0)
  series.forEach((s, i) => {
    series[i] = Array(seriesLength).fill(0)
  })
  // poke values into the matrix where there is interval data.
  for (let t = start; t < end; t += intervalSize) {
    labels.push(moment.utc(t).format(timeFormat))
    let pos = labels.length - 1
    data
      .filter((d) => d[field] === t)
      .forEach(({kudosPoints, types = ['Activity']}) => {
        const meta = types[0] || 'Activity'
        const datum = {value: kudosPoints, meta}
        const index = activityNames.indexOf(meta)
        const group = series[index] || []
        group[pos] = datum
        series[index] = group
      })
  }
  return { labels, series }
}

function getDailyGraphData ({ db, user, strategy, startDate = new Date() }, cb) {
  const {start, end} = getStartAndEnd('day', startDate)
  let query = { userId: user._id, startDate: { $gte: start } }
  if (strategy) {
    query.method = strategy
  } else {
    query.maxForPeriod = true
  }
  db.intervals.find(query, (err, res) => {
    if (err) return cb(err)
    const graphData = graphFormat({
      data: res,
      field: 'startDate',
      timeFormat: 'ha',
      intervalSize: config.intervalSize,
      start,
      end
    })
    cb(null, graphData)
  })
}

function getWeeklyGraphData ({ db, user, strategy, startDate = new Date() }, cb) {
  const {start, end} = getStartAndEnd('week', startDate)
  let query = { userId: user._id, startDate: { $gte: start } }
  if (strategy) {
    query.method = strategy
  } else {
    query.maxForPeriod = true
  }
  db.intervals.aggregate([
    { $match: query },
    { $group: { _id: { startOfDay: '$startOfDay', type: { $arrayElemAt: ['$types', 0] } }, kudosPoints: { $sum: '$kudosPoints' } } },
    { $project: { startOfDay: '$_id.startOfDay', types: ['$_id.type'], kudosPoints: '$kudosPoints', _id: 0 } }
  ], (err, res) => {
    if (err) return cb(err)
    const graphData = graphFormat({
      data: res,
      field: 'startOfDay',
      timeFormat: 'ddd D MMM',
      intervalSize: msInDay,
      start,
      end
    })
    cb(null, graphData)
  })
}

function getMonthlyGraphData ({ db, user, strategy, startDate = new Date() }, cb) {
  const {start, end} = getStartAndEnd('month', startDate)
  let query = { userId: user._id, startDate: { $gte: start } }
  if (strategy) {
    query.method = strategy
  } else {
    query.maxForPeriod = true
  }
  db.intervals.aggregate([
    { $match: query },
    { $group: { _id: { startOfDay: '$startOfDay', type: { $arrayElemAt: ['$types', 0] } }, kudosPoints: { $sum: '$kudosPoints' } } },
    { $project: { startOfDay: '$_id.startOfDay', types: ['$_id.type'], kudosPoints: '$kudosPoints', _id: 0 } }
  ], (err, res) => {
    if (err) return cb(err)
    const graphData = graphFormat({
      data: res,
      field: 'startOfDay',
      timeFormat: 'D MMM',
      intervalSize: msInDay,
      start,
      end
    })
    cb(null, graphData)
  })
}

module.exports = {
  getDailyGraphData: getDailyGraphData,
  getWeeklyGraphData: getWeeklyGraphData,
  getMonthlyGraphData: getMonthlyGraphData
}
