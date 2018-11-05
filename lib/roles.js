// Return true if doc.roles includes one of the passed roles
module.exports.hasRole = (doc, roles) => {
  if (!doc) return false
  roles = Array.isArray(roles) ? roles : [roles]
  if (!roles.length) return false
  return roles.some((r) => doc.roles.includes(r))
}
