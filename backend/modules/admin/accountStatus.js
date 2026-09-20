// Whether an account can sign in yet, for the admin lists:
// - active: it has a password or signs in through SSO
// - invited: an invitation was sent and is waiting to be used
// - no_sign_in: it has no way to sign in, for example a member added
//   without an email
const accountStatusOf = (user, hasIdentity = false) => {
    if (user.password_digest || hasIdentity) return 'active';
    if (user.email && user.email_verified === false) return 'invited';
    return 'no_sign_in';
};

module.exports = { accountStatusOf };
