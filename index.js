const Hapi = require('hapi')
const auth0Strategy = require('./lib/auth0-strategy')
const migrate = require('./lib/migrate')
const dailyCoin = require('./extentions/daily-coin')

module.exports.createServer = ({ db, cachedCalc, uploadcare, mailer, auth0Api, cron }, config, cb) => {
  const server = new Hapi.Server()

  server.connection({
    port: config.port,
    routes: {
      cors: {
        exposedHeaders: ['WWW-Authenticate', 'Server-Authorization', 'Authorization']
      }
    }
  })

  server.ext('onPostAuth', dailyCoin(db))

  server.register([
    require('hapi-auth-jwt2'),
    {
      register: require('good'),
      options: {
        reporters: {
          console: [{ module: 'good-console' }, 'stdout']
        }
      }
    }
  ], (err) => {
    if (err) return cb(err)

    migrate(db, (err) => {
      if (err) return cb(err)

      server.auth.strategy('auth0', 'jwt', 'optional', auth0Strategy(db, config))

      const routes = require('./routes')

      server.route([
        routes.auth.emailPassword({ db }),
        routes.auth.email({ db }),
        routes.user.get({ db }),
        routes.user.post({ db, auth0Api }, config),
        routes.user.patch({ db, uploadcare, auth0Api }),
        routes.connect.connect({ db }),
        routes.connect.disconnect({ db }),
        routes.leagues.get({ db }),
        routes.league.get({ db }),
        routes.league.post({ db }),
        routes.league.delete({ db }),
        routes.league.join({ db }),
        routes.league.switch({ db }),
        routes.league.public({ db }),
        routes['league-leaderboard'].get({ db }),
        routes['league-members'].add({ db, mailer }),
        routes['league-members'].invite({ db, mailer }),
        routes['league-member'].delete({ db }),
        routes.team.get({ db }),
        routes.team.patch({ db }),
        routes['team-leaderboard'].get({ db }),
        routes.companies.get({ db }),
        routes['company-leaderboard'].get({ db }),
        routes['company-members'].get({ db }),
        routes['company-members'].post({ db }),
        routes['company-members-coins'].post({ db, mailer }),
        routes['company-member'].delete({ db }),
        routes['company-leagues'].getLeagues({ db }),
        routes['company-leagues'].getLeaguesLeaderboard({ db, cachedCalc }),
        routes['company-league'].post({ db, mailer }),
        routes['company-league'].delete({ db }),
        routes['company-stats'].get({ db }),
        routes['company-token'].getTokens({ db }),
        routes['company-token'].post({ db }),
        routes['company-token'].revoke({ db }),
        routes['company-token'].getCompany({ db }),
        routes['company-shop-items'].get({ db }),
        routes['company-shop-item'].get({ db }),
        routes['company-shop-item'].post({ db, uploadcare }),
        routes['company-shop-item'].patch({ db, uploadcare }),
        routes['company-shop-item'].delete({ db }),
        routes['company-shop-item-buy'].post({ db, mailer }),
        routes['company-charity-buckets'].get({ db }),
        routes['company-charity-bucket'].get({ db }),
        routes['company-charity-bucket'].post({ db, uploadcare }),
        routes['company-charity-bucket'].patch({ db, uploadcare }),
        routes['company-charity-bucket'].delete({ db }),
        routes['company-charity-bucket-donate'].post({ db, mailer }),
        routes['company-transaction-logs'].get({ db }),
        routes.admin.users.get({ db }),
        routes.admin.user.get({ db }),
        routes.admin.user.patch({ db }),
        routes.admin.user.delete({ db, auth0Api }),
        routes.admin.companies.get({ db }),
        routes.admin.company.post({ db, uploadcare }),
        routes.admin.company.delete({ db }),
        routes.admin.company.get({ db }),
        routes.admin.company.patch({ db, uploadcare }),
        routes.admin['company-locations'].put({ db }),
        routes.admin['company-locations'].patch({ db }),
        routes.admin['company-locations'].delete({ db }),
        routes.admin['company-departments'].put({ db }),
        routes.admin['company-departments'].patch({ db }),
        routes.admin['company-departments'].delete({ db }),
        routes.admin['company-moderators'].get({ db }),
        routes.admin['company-moderators'].post({ db }),
        routes.admin['company-moderator'].delete({ db }),
        routes.admin['public-league'].post({ db, uploadcare }),
        routes.admin['public-league'].patch({ db, uploadcare }),
        routes.admin['public-league'].delete({ db, uploadcare }),
        routes.notifications.get({ db }),
        routes.notifications.confirm({ db }),
        routes.notifications.reject({ db }),
        routes.graph.get({ db }),
        routes.stats.get({ db }),
        routes['search-users'].get({ db }),
        routes['transaction-logs'].get({ db })
      ])

      cb(null, { server, db, cachedCalc, uploadcare, mailer, cron })
    })
  })
}
