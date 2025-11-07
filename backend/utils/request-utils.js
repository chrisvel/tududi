const getAuthenticatedUserId = (req) =>
    req.currentUser?.id || req.session?.userId;

module.exports = {
    getAuthenticatedUserId,
};
