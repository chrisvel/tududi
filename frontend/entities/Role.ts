// account_admin only exists on tududi Cloud: an admin of one customer
// account. There, admin is the superadmin who runs the instance.
export type RoleId = 'admin' | 'account_admin' | 'user' | 'guest';

export type Capability = 'create_people' | 'invite_members' | 'create_projects';

export type Capabilities = Record<Capability, boolean>;

export const ROLE_IDS: RoleId[] = ['admin', 'user', 'guest'];

// Roles whose permissions are fixed (everything) rather than set per account.
export const isAdminRole = (role?: RoleId | null): boolean =>
    role === 'admin' || role === 'account_admin';

// Who sees the Access page (users, groups, roles): the instance admin, and on
// tududi Cloud an admin of a customer account, for that account only.
export const canOpenAccess = (user?: {
    is_admin?: boolean;
    role?: RoleId | string | null;
}): boolean => user?.is_admin === true || user?.role === 'account_admin';

export const CAPABILITY_IDS: Capability[] = [
    'create_people',
    'invite_members',
    'create_projects',
];

export interface RoleSummary {
    id: RoleId;
    capabilities: Capabilities;
    member_count: number;
}

export interface RolesOverview {
    capabilities: Capability[];
    roles: RoleSummary[];
}
