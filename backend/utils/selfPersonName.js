// The name of the person that stands for an account: the account's own name,
// else the part of its email before the @. An account with neither (a member
// added without an email or a name) still needs one.
const selfPersonName = (user) => {
    const nameParts = [user.name, user.surname].filter(Boolean);
    if (nameParts.length > 0) return nameParts.join(' ').trim();
    if (user.email) return user.email.split('@')[0];
    return 'Member';
};

module.exports = { selfPersonName };
