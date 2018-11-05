const Async = require('async')
const Boom = require('boom')
const moment = require('moment')

module.exports = (db) => {
  function joinIndividualLeague ({ userId, leagueId, confirm }, cb) {
    Async.waterfall([
      function (cb) {
        db.leagues.findOne({ _id: leagueId, deleted: false }, cb)
      },
      function (league, cb) {
        if (!league) return cb(Boom.notFound('League not found'))

        const member = (league.members || []).find((m) => m.user.equals(userId))

        if (member && member.activated) {
          return cb(Boom.conflict('User has already been activated in league'))
        }

        if (league.leagueType !== 'public') return cb(null, league)

        // If this is a public league, check the user is in a company
        db.companies.count({ members: { $elemMatch: { user: userId, active: true, activated: true } } }, (err, companyCount) => {
          if (err) return cb(err)
          if (!companyCount) return cb(Boom.forbidden('Only an activated company member can join a public league'))

          cb(null, league)
        })
      },
      function (league, cb) {
        addLeagueMember(userId, league, confirm, cb)
      }
    ], (err) => {
      if (err) return cb(err)
      cb()
    })
  }

  function joinGroupLeague ({ userId, leagueId, panelId, confirm }, cb) {
    Async.waterfall([
      function getLeague (cb) {
        db.leagues.findOne({ _id: leagueId, deleted: false }, cb)
      },
      function getPanels (league, cb) {
        if (!league) return cb(Boom.notFound('League not found'))

        const member = (league.members || []).find((m) => m.user.equals(userId))

        if (member && member.activated) {
          return cb(Boom.conflict('User has already been activated in league'))
        }

        db.panels.find({ _id: { $in: league.panel.map((panel) => panel.panelId) } }, (err, panels) => {
          cb(err, league, panels)
        })
      },
      // If this is a public league, the user will not have supplied a panelId, and we may need to make a new panel for their company
      function makePanelIfRequired (league, panels, cb) {
        if (league.leagueType !== 'public') return cb(null, league, panelId)

        db.companies.findOne({ members: { $elemMatch: { user: userId, active: true, activated: true } } }, (err, company) => {
          if (err) return cb(err)
          if (!company) return cb(Boom.forbidden('Only an activated company member can join a public league'))

          const panel = panels.find((p) => p.name === company.name)
          if (panel) return cb(null, league, panel._id)

          db.panels.insert({ name: company.name, deleted: false }, (err, panel) => {
            if (err) return cb(err)
            const panelId = panel._id

            db.leagues.findAndModify({
              query: { _id: league._id },
              update: { $push: { panel: { panelId } } },
              new: true
            }, (err, league) => {
              if (err) return cb(err)

              cb(null, league, panelId)
            })
          })
        })
      },
      function getTeamIfRequired (league, panelId, cb) {
        if (league.teamSize === 1 || !confirm) {
          return cb(null, league, null)
        }

        if (!panelId) {
          return cb(Boom.badRequest('You must supply a panelId to join a league which is not individual'))
        }

        getTeam(league, panelId, (err, team) => {
          if (err) return cb(err)
          cb(null, league, team._id)
        })
      },
      function updateTeamIfRequired (league, teamId, cb) {
        if (!teamId) return cb(null, league)

        let member = (league.members || []).find((m) => m.user.equals(userId))
        member = member || { user: userId }
        member = Object.assign(member, { activated: true, active: confirm, startDate: new Date() })
        const query = { _id: teamId }
        const update = { $push: { members: member }, $inc: { memberCount: 1 } }

        db.teams.update(query, update, (err) => cb(err, league))
      },
      function (league, cb) {
        addLeagueMember(userId, league, confirm, cb)
      }
    ], (err) => {
      if (err) return cb(err)
      cb()
    })
  }

  function joinCompany ({ userId, companyId, confirm }, cb) {
    Async.waterfall([
      function (cb) {
        db.companies.findOne({ _id: companyId, deleted: false }, cb)
      },
      function (company, cb) {
        if (!company) return cb(Boom.notFound('Company not found'))

        const member = (company.members || []).find((m) => m.user.equals(userId))

        if (member && member.activated) {
          return cb(Boom.conflict('User has already been activated in company'))
        }

        cb(null, company)
      },
      function (company, cb) {
        addCompanyMember(userId, company, confirm, (err) => cb(err, company))
      },
      function updateCompanyNameAndRoles (company, cb) {
        const query = { _id: userId }
        const update = { $set: { companyName: company.name } }
        const companyRoles = company.roles || []

        if (companyRoles.length) {
          update.$addToSet = { roles: { $each: companyRoles } }
        }

        db.users.update(query, update, (err) => cb(err))
      }
    ], cb)
  }

  function joinCompanyAsCorpMod ({ userId, companyId, confirm }, cb) {
    Async.waterfall([
      function (cb) {
        db.companies.findOne({ _id: companyId, deleted: false }, cb)
      },
      function (company, cb) {
        if (!company) return cb(Boom.notFound('Company not found'))

        const moderator = (company.moderators || []).find((m) => m.user.equals(userId))

        if (moderator && moderator.activated) {
          return cb(Boom.conflict('User has already been activated in company'))
        }

        cb(null, company)
      },
      function (company, cb) {
        addCompanyModerator(userId, company, confirm, (err) => cb(err, company))
      },
      function makeUserCorporateMod (company, cb) {
        const query = { _id: userId }
        const update = { $set: { companyName: company.name } }
        const companyRoles = company.roles || []

        if (companyRoles.length) {
          update.$addToSet = { roles: { $each: companyRoles.concat('corporate_mod') } }
        } else {
          update.$addToSet = { roles: 'corporate_mod' }
        }

        db.users.update(query, update, cb)
      }
    ], (err) => {
      if (err) return cb(err)
      cb()
    })
  }

  return {
    joinGroupLeague,
    joinIndividualLeague,
    joinCompany,
    joinCompanyAsCorpMod
  }

  // HELPER FUNCTIONS

  function addLeagueMember (userId, league, confirm, cb) {
    const member = (league.members || []).find((m) => m.user.equals(userId))

    if (member) {
      db.leagues.update({
        _id: league._id,
        'members.user': userId
      }, {
        $set: {
          'members.$.active': confirm,
          'members.$.activated': true,
          'members.$.startDate': moment.utc().toDate()
        }
      }, cb)
    } else {
      db.leagues.update({
        _id: league._id
      }, {
        $push: {
          members: {
            user: userId,
            active: confirm,
            activated: true,
            startDate: moment.utc().toDate()
          }
        }
      }, cb)
    }
  }

  function addCompanyMember (userId, company, confirm, cb) {
    const member = (company.members || []).find((m) => m.user.equals(userId))

    if (member) {
      db.companies.update({
        _id: company._id,
        'members.user': userId
      }, {
        $set: {
          'members.$.active': confirm,
          'members.$.activated': true,
          'members.$.startDate': moment.utc().toDate()
        }
      }, cb)
    } else {
      db.companies.update({
        _id: company._id
      }, {
        $push: {
          members: {
            user: userId,
            active: confirm,
            activated: true,
            startDate: moment.utc().toDate()
          }
        }
      }, cb)
    }
  }

  function addCompanyModerator (userId, company, confirm, cb) {
    const member = (company.moderators || []).find((m) => m.user.equals(userId))

    if (member) {
      db.companies.update({
        _id: company._id,
        'moderators.user': userId
      }, {
        $set: {
          'moderators.$.active': confirm,
          'moderators.$.activated': true,
          'moderators.$.startDate': moment.utc().toDate()
        }
      }, cb)
    } else {
      db.companies.update({
        _id: company._id
      }, {
        $push: {
          moderators: {
            user: userId,
            active: confirm,
            activated: true,
            startDate: moment.utc().toDate()
          }
        }
      }, cb)
    }
  }

  function getTeam (league, panelId, cb) {
    const panel = league.panel.find((p) => p.panelId.equals(panelId))

    if (!panel) return cb(Boom.notFound('Panel does not exist for that league'))

    Async.waterfall([
      function getPanel (cb) {
        const query = { _id: panelId, deleted: false }

        db.panels.findOne(query, (err, panel) => {
          if (err) return cb(err)
          if (!panel) return cb(Boom.notFound('Panel not found'))
          cb(null, panel)
        })
      },
      function getTeam (panel, cb) {
        const teamIds = (panel.team || []).map((t) => t.teamId)

        // No existing teams!
        if (!teamIds.length) {
          return cb(null, { panel })
        }

        const query = { deleted: false, _id: { $in: teamIds } }

        if (league.teamSize) query.memberCount = { $lt: league.teamSize }

        db.teams.findOne(query, (err, team) => cb(err, { team, panel }))
      },
      function makeNewTeamIfNecessary ({ team, panel }, cb) {
        if (team) return cb(null, team)

        Async.waterfall([
          function countTeams (done) {
            const teamIds = (panel.team || []).map((t) => t.teamId)

            // No existing teams!
            if (!teamIds.length) {
              return done(null, 0)
            }

            const query = { deleted: false, _id: { $in: teamIds } }
            db.teams.count(query, done)
          },
          function makeNewTeam (teamCount, done) {
            db.teams.insert({
              name: `Team ${teamCount + 1} - ${panel.name}`,
              startDate: league.startDate,
              endDate: league.endDate,
              moderators: league.moderators,
              members: [],
              memberCount: 0,
              panel: {
                _id: panel._id,
                name: panel.name
              },
              deleted: false
            }, done)
          },
          function updatePanel (newTeam, done) {
            const query = { _id: panelId }
            const update = { $push: { team: { teamId: newTeam._id } } }
            db.panels.update(query, update, (err) => done(err, newTeam))
          }
        ], cb)
      }
    ], cb)
  }
}
