export interface UserFeatures {
    task_intelligence_enabled?: boolean;
    auto_suggest_next_actions_enabled?: boolean;
    productivity_assistant_enabled?: boolean;
    next_task_suggestion_enabled?: boolean;
    pomodoro_enabled?: boolean;
    eisenhower_enabled?: boolean;
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
    features?: UserFeatures;
}
