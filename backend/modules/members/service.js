'use strict';

const { sequelize, User, Person } = require('../../models');
const rolesService = require('../../services/rolesService');
const { validateCreateUser } = require('../admin/validation');
const { accountStatusOf } = require('../admin/accountStatus');
const {
    getDefaultNotificationPreferences,
} = require('../../utils/notificationPreferences');
const { logError } = require('../../services/logService');
const {
    NotFoundError,
    ConflictError,
    ForbiddenError,
    ValidationError,
} = require('../../shared/errors');

// The parts of a contact's name, as the first name and the rest, the same way
// renaming a person renames its account.
function splitName(fullName) {
    const [first, ...rest] = String(fullName || '')
        .trim()
        .split(/\s+/);
    return { name: first || null, surname: rest.join(' ') || null };
}

// A contact that is about to become the person of a new account: it must be
// one of the caller's own and must not already stand for an account.
async function findContactToConvert(actorId, personUid) {
    const person = await Person.findOne({
        where: { uid: personUid, user_id: actorId },
    });
    if (!person) throw new NotFoundError('Person not found');
    if (person.linked_user_id != null) {
        throw new ConflictError('That person already has an account');
    }
    return person;
}

function assertMayGrant(actorIsAdmin, { role, capabilities }) {
    if (actorIsAdmin) return;
    if (role !== undefined && role !== 'user' && role !== 'guest') {
        throw new ForbiddenError('Only an admin can create an admin');
    }
    if (capabilities !== undefined) {
        throw new ForbiddenError('Only an admin can set permissions');
    }
}

class MembersService {
    // Creates an account: invited by email, signed up with a password, or with
    // neither for a member who cannot sign in yet. With person_uid the contact
    // becomes the account's own person, keeping its uid so every task assigned
    // to it stays assigned.
    //
    // Who may call it is decided by the route (the invite permission, or admin).
    // Here an admin may set anything, and anyone else may only add a user or a
    // guest with the default permissions, so the permission cannot be used to
    // hand out more than the caller has.
    async createMember(actorId, body) {
        const actorIsAdmin = await rolesService.isAdmin(actorId);
        const input = body || {};
        assertMayGrant(actorIsAdmin, input);

        const personUid = input.person_uid || input.linked_person_uid;
        if (personUid !== undefined && typeof personUid !== 'string') {
            throw new ValidationError('person_uid must be text');
        }
        const contact = personUid
            ? await findContactToConvert(actorId, personUid)
            : null;

        const named = { ...input };
        if (contact && !named.name && !named.surname) {
            Object.assign(named, splitName(contact.name));
        }
        const { email, password, name, surname, role, capabilities } =
            validateCreateUser(named);
        const requireVerification = named.require_verification === true;

        const hasEmail = Boolean(email);
        // Only an account with an email can be invited or asked to verify.
        const invite = !password && hasEmail;
        // An invite already verifies the email when its link is used, so the
        // switch only matters for accounts that are given a password.
        const verify = requireVerification && !invite && hasEmail;

        const userData = {
            notification_preferences: getDefaultNotificationPreferences(),
            created_by_user_id: actorId,
        };
        if (hasEmail) userData.email = email;
        if (password) {
            userData.password = password;
            if (verify) userData.email_verified = false;
        } else if (invite) {
            // No password yet: the account is inert until the invite link is
            // used, which also verifies the email.
            userData.email_verified = false;
        }
        if (name) userData.name = name;
        if (surname) userData.surname = surname;

        let user;
        let person;
        try {
            await sequelize.transaction(async (transaction) => {
                user = await User.create(userData, {
                    transaction,
                    skipSelfPerson: Boolean(contact),
                });

                if (role && role !== 'user') {
                    await rolesService.setRole(user.id, role, { transaction });
                }
                if (capabilities) {
                    await rolesService.setCapabilities(user.id, capabilities, {
                        transaction,
                    });
                }

                if (contact) {
                    // The private notes were written about the contact by
                    // someone else, and the account now owns this record. The
                    // update only matches a contact that is still free, so of
                    // two requests converting the same contact one wins and
                    // the other rolls its new account back.
                    const [adopted] = await Person.update(
                        {
                            user_id: user.id,
                            linked_user_id: user.id,
                            email: user.email || null,
                            notes: null,
                            archived: false,
                        },
                        {
                            where: {
                                id: contact.id,
                                user_id: actorId,
                                linked_user_id: null,
                            },
                            transaction,
                        }
                    );
                    if (adopted === 0) {
                        throw new ConflictError(
                            'That person already has an account'
                        );
                    }
                    person = contact;
                }
            });
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        if (!person) {
            person = await Person.findOne({
                where: { user_id: user.id, linked_user_id: user.id },
            });
        }

        const emailSent = await this.sendEmails(user, { verify, invite });

        return {
            id: user.id,
            email: user.email ?? null,
            name: user.name,
            surname: user.surname,
            created_at: user.created_at,
            account_status: accountStatusOf(user),
            ...(await rolesService.getRoleInfo(user.id)),
            person_uid: person ? person.uid : null,
            invited: invite,
            verification_requested: verify,
            email_sent: emailSent,
        };
    }

    async sendEmails(user, { verify, invite }) {
        let emailSent = false;
        if (verify) {
            const {
                resendVerificationEmail,
            } = require('../auth/registrationService');
            try {
                const result = await resendVerificationEmail(user.email);
                emailSent = result.sent;
            } catch (err) {
                // The account stays; it can be verified by hand.
                logError(err, 'Failed to send verification email');
            }
        }
        if (invite) {
            const {
                sendMemberInviteEmail,
            } = require('../auth/passwordResetService');
            try {
                const result = await sendMemberInviteEmail(user);
                emailSent = result.sent;
            } catch (err) {
                // The account stays; the invitation can be sent again.
                logError(err, 'Failed to send member invite email');
            }
        }
        return emailSent;
    }
}

module.exports = new MembersService();
