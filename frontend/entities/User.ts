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
    // when the welcome page was done with; older servers omit it
    onboarded_at?: string | null;
    // the starter picked on the welcome screen ("household", "empty", ...);
    // null until that screen is done with
    onboarding_starter?: string | null;
}
