module.exports.toUserRef = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatar: user.avatar
})
