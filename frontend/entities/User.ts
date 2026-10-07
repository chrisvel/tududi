import { Capabilities, RoleId } from './Role';

export interface UserFeatures {
    pomodoro_enabled?: boolean;
    eisenhower_enabled?: boolean;
    kanban_enabled?: boolean;
}

export interface User {
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    language: string;
    appearance: string;
    timezone: string;
    avatarUrl?: string;
    is_admin?: boolean;
    role?: RoleId;
    capabilities?: Capabilities;
    features?: UserFeatures;
}
