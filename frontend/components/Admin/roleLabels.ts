import { TFunction } from 'i18next';
import { Capability, RoleId } from '../../entities/Role';

export const roleName = (t: TFunction, id: RoleId): string =>
    ({
        admin: t('admin.roles.names.admin', 'Admin'),
        user: t('admin.roles.names.user', 'User'),
        guest: t('admin.roles.names.guest', 'Guest'),
    })[id];

export const roleDescription = (t: TFunction, id: RoleId): string =>
    ({
        admin: t(
            'admin.roles.descriptions.admin',
            'Manages accounts, roles and groups, and can do everything else.'
        ),
        user: t(
            'admin.roles.descriptions.user',
            'A regular member. Works with their own items and everything shared with them.'
        ),
        guest: t(
            'admin.roles.descriptions.guest',
            'Works inside what is shared with them or assigned to them.'
        ),
    })[id];

export const capabilityName = (t: TFunction, id: Capability): string =>
    ({
        create_people: t('admin.roles.capabilities.createPeople', 'Add people'),
        invite_members: t(
            'admin.roles.capabilities.inviteMembers',
            'Invite members'
        ),
        create_projects: t(
            'admin.roles.capabilities.createProjects',
            'Create projects, areas and goals'
        ),
    })[id];

export const capabilityHint = (t: TFunction, id: Capability): string =>
    ({
        create_people: t(
            'admin.roles.capabilityHints.createPeople',
            'Add contacts and members to the People list'
        ),
        invite_members: t(
            'admin.roles.capabilityHints.inviteMembers',
            'Create accounts, send invitations or sign people up'
        ),
        create_projects: t(
            'admin.roles.capabilityHints.createProjects',
            'Start new projects, areas and goals'
        ),
    })[id];
