'use strict';
// Credentials establish the actor; callers cannot label an integration as human.
function actorFromRequest(req, userId) {
    const human = req.session?.userId && !req.headers.authorization;
    return {
        user_id: userId,
        actor_type: human ? 'user' : 'mcp',
        actor_id: human
            ? String(userId)
            : req.authToken?.id == null
              ? null
              : String(req.authToken.id),
    };
}
module.exports = { actorFromRequest };
