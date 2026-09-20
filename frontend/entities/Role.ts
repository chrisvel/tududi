export type RoleId = 'admin' | 'user' | 'guest';

export type Capability = 'create_people' | 'invite_members' | 'create_projects';

export type Capabilities = Record<Capability, boolean>;

export const ROLE_IDS: RoleId[] = ['admin', 'user', 'guest'];

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
