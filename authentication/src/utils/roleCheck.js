const ROLE_HIERARCHY = require("./roles");

const canCreateRole = (creatorRole, targetRole) => {
  return ROLE_HIERARCHY[creatorRole] > ROLE_HIERARCHY[targetRole];
};

module.exports = canCreateRole;