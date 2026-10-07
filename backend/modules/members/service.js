'use strict';

const { Op } = require('sequelize');
const { sequelize, User, Person, Role } = require('../../models');
const rolesService = require('../../services/rolesService');
const seats = require('../../services/seatsService');
const accounts = require('../../services/accountsService');
const { eraseUserAccount } = require('../../services/accountErasureService');
const {
    validateCreateUser,
    validateEmail,
    validatePersonName,
} = require('../admin/validation');
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

// The member an actor may change: one it created, any member of its account
// for an admin of a hosted account (except the owner), or any account for the
// superadmin; never the actor itself and never the superadmin. Anyone else is
// told the member does not exist, so account ids cannot be probed.
async function findManagedMember(actorId, memberId) {
    const [actorIsAdmin, target, targetRole, managedByAccount] =
        await Promise.all([
            rolesService.isAdmin(actorId),
            User.findByPk(memberId),
            Role.findOne({ where: { user_id: memberId } }),
            accounts.managesUser(actorId, memberId),
        ]);
    const mayManage =
        actorIsAdmin ||
        managedByAccount ||
        (target &&
            target.created_by_user_id != null &&
            target.created_by_user_id === actorId);
    if (!target || target.id === actorId || !mayManage) {
        throw new NotFoundError('Member not found');
    }
    if (targetRole && targetRole.is_admin) {
        throw new ForbiddenError('An admin cannot be changed here');
    }
    return target;
}

// The superadmin may set anything. An admin of a hosted account may add
// users, guests and other admins of its account and set their permissions.
// Anyone else only adds a user or a guest with the default permissions.
function assertMayGrant(actorIsAdmin, actorIsAccountAdmin, input) {
    const { role, capabilities } = input;
    if (actorIsAdmin) return;
    const grantable = actorIsAccountAdmin
        ? ['user', 'guest', 'account_admin']
        : ['user', 'guest'];
    if (role !== undefined && !grantable.includes(role)) {
        throw new ForbiddenError('Only an admin can create an admin');
    }
    if (capabilities !== undefined && !actorIsAccountAdmin) {
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
        const actorIsAccountAdmin =
            !actorIsAdmin && (await rolesService.isAccountAdmin(actorId));
        const input = body || {};
        assertMayGrant(actorIsAdmin, actorIsAccountAdmin, input);

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

        // On a hosted instance the member is a paid seat: it is added to the
        // account owner's subscription first, so a refused payment creates
        // nothing.
        const payerId = actorIsAdmin
            ? null
            : await accounts.getOwnerId(actorId);
        if (payerId) await seats.addSeat(payerId);

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
            if (payerId) await seats.reconcile(payerId);
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

    // Renames a member, or gives a member without an email one, which sends
    // them an invitation. An email that is already set cannot be changed
    // here: that would let whoever made the account take over its sign-in.
    async updateMember(actorId, memberId, body) {
        const member = await findManagedMember(actorId, memberId);
        const { name, surname, email } = body || {};

        if (name !== undefined) member.name = validatePersonName(name, 'Name');
        if (surname !== undefined) {
            member.surname = validatePersonName(surname, 'Surname');
        }

        let invite = false;
        if (email !== undefined && email !== null && String(email).trim()) {
            if (member.email) {
                throw new ForbiddenError(
                    'This member already has an email address'
                );
            }
            member.email = validateEmail(String(email).trim().toLowerCase());
            member.email_verified = false;
            invite = true;
        }

        try {
            await member.save();
        } catch (err) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                throw new ConflictError('Email already exists');
            }
            throw err;
        }

        const emailSent = invite
            ? await this.sendEmails(member, { verify: false, invite: true })
            : false;

        return {
            id: member.id,
            email: member.email ?? null,
            name: member.name,
            surname: member.surname,
            account_status: accountStatusOf(member),
            invited: invite,
            email_sent: emailSent,
        };
    }

    // Which of these accounts the actor may rename or remove: the ones it
    // created, or any for an admin, never an admin and never itself.
    async manageableAccountIds(actorId, accountIds) {
        const ids = Array.from(new Set(accountIds)).filter(
            (id) => id && id !== actorId
        );
        if (ids.length === 0) return new Set();

        const [actorIsAdmin, targets, adminRoles, managed] = await Promise.all([
            rolesService.isAdmin(actorId),
            User.findAll({
                where: { id: { [Op.in]: ids } },
                attributes: ['id', 'created_by_user_id'],
                raw: true,
            }),
            Role.findAll({
                where: { user_id: { [Op.in]: ids }, is_admin: true },
                attributes: ['user_id'],
                raw: true,
            }),
            accounts.managedUserIds(actorId),
        ]);
        const admins = new Set(adminRoles.map((row) => row.user_id));
        return new Set(
            targets
                .filter((t) => !admins.has(t.id))
                .filter(
                    (t) =>
                        actorIsAdmin ||
                        managed.has(t.id) ||
                        t.created_by_user_id === actorId
                )
                .map((t) => t.id)
        );
    }

    // Deletes a member's account and everything in it, then gives the seat
    // back on the account owner's subscription.
    async removeMember(actorId, memberId) {
        const member = await findManagedMember(actorId, memberId);
        const payerId = await accounts.getOwnerId(member.id);
        await eraseUserAccount(member.id);
        if (payerId !== member.id) await seats.reconcile(payerId);
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
