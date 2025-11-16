import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

interface Profile {
    id: number;
    email: string;
    appearance: 'light' | 'dark';
    language: string;
    timezone: string;
    first_day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
    avatar_image: string | null;
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
    task_summary_enabled: boolean;
    task_summary_frequency: string;
    task_intelligence_enabled: boolean;
    auto_suggest_next_actions_enabled: boolean;
    productivity_assistant_enabled: boolean;
    next_task_suggestion_enabled: boolean;
}

interface SchedulerStatus {
    success: boolean;
    enabled: boolean;
    frequency: string;
    last_run: string | null;
    next_run: string | null;
}

interface TelegramBotInfo {
    username: string;
    first_name?: string;
    polling_status: any;
    chat_url: string;
}

export const fetchProfile = async (): Promise<Profile> => {
    const response = await fetch(getApiPath('profile'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch profile data.');
    return await response.json();
};

export const updateProfile = async (
    profileData: Partial<Profile>
): Promise<Profile> => {
    const response = await fetch(getApiPath('profile'), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(profileData),
    });
    await handleAuthResponse(response, 'Failed to update profile.');
    return await response.json();
};

export const fetchSchedulerStatus = async (): Promise<SchedulerStatus> => {
    const response = await fetch(getApiPath('profile/task-summary/status'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch scheduler status.');
    return await response.json();
};

export const sendTaskSummaryNow = async (): Promise<any> => {
    const response = await fetch(getApiPath('profile/task-summary/send-now'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to send task summary.');
    return await response.json();
};

export const fetchTelegramPollingStatus = async (): Promise<any> => {
    const response = await fetch(getApiPath('telegram/polling-status'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch polling status.');
    return await response.json();
};

export const setupTelegram = async (
    botToken: string,
    chatId: string
): Promise<TelegramBotInfo> => {
    const response = await fetch(getApiPath('telegram/setup'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            bot_token: botToken,
            chat_id: chatId,
        }),
    });
    await handleAuthResponse(response, 'Failed to setup telegram.');
    return await response.json();
};

export const startTelegramPolling = async (): Promise<any> => {
    const response = await fetch(getApiPath('telegram/start-polling'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to start telegram polling.');
    return await response.json();
};

export const stopTelegramPolling = async (): Promise<any> => {
    const response = await fetch(getApiPath('telegram/stop-polling'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to stop telegram polling.');
    return await response.json();
};

export const testTelegram = async (
    userId: number,
    message: string
): Promise<any> => {
    const response = await fetch(getApiPath(`telegram/test/${userId}`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ text: message }),
    });
    await handleAuthResponse(response, 'Failed to send test message.');
    return await response.json();
};

export const toggleTaskSummary = async (): Promise<any> => {
    const response = await fetch(getApiPath('profile/task-summary/toggle'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to toggle task summary.');
    return await response.json();
};

export const updateTaskSummaryFrequency = async (
    frequency: string
): Promise<any> => {
    const response = await fetch(getApiPath('profile/task-summary/frequency'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ frequency }),
    });
    await handleAuthResponse(
        response,
        'Failed to update task summary frequency.'
    );
    return await response.json();
};

export type { Profile };

export const getTaskIntelligenceEnabled = async (): Promise<boolean> => {
    try {
        const profile = await fetchProfile();
        return profile.task_intelligence_enabled !== undefined
            ? profile.task_intelligence_enabled
            : true;
    } catch (error) {
        console.error('Error fetching task intelligence setting:', error);
        return true; // Default to enabled if we can't fetch the setting
    }
};

export const getAutoSuggestNextActionsEnabled = async (): Promise<boolean> => {
    try {
        const profile = await fetchProfile();
        return profile.auto_suggest_next_actions_enabled !== undefined
            ? profile.auto_suggest_next_actions_enabled
            : true;
    } catch (error) {
        console.error(
            'Error fetching auto-suggest next actions setting:',
            error
        );
        return true; // Default to enabled if we can't fetch the setting
    }
};

export const getProductivityAssistantEnabled = async (): Promise<boolean> => {
    try {
        const profile = await fetchProfile();
        return profile.productivity_assistant_enabled !== undefined
            ? profile.productivity_assistant_enabled
            : true;
    } catch (error) {
        console.error('Error fetching productivity assistant setting:', error);
        return true; // Default to enabled if we can't fetch the setting
    }
};

export const getNextTaskSuggestionEnabled = async (): Promise<boolean> => {
    try {
        const profile = await fetchProfile();
        return profile.next_task_suggestion_enabled !== undefined
            ? profile.next_task_suggestion_enabled
            : true;
    } catch (error) {
        console.error('Error fetching next task suggestion setting:', error);
        return true; // Default to enabled if we can't fetch the setting
    }
};

/**
 * Gets the first day of the week (0 = Sunday, 1 = Monday, etc.)
 * Falls back to locale-based defaults if not set in profile
 */
export const getFirstDayOfWeek = async (): Promise<number> => {
    try {
        const profile = await fetchProfile();
        if (profile.first_day_of_week !== undefined) {
            return profile.first_day_of_week;
        }

        // Fallback to locale-based default
        return getLocaleFirstDayOfWeek(profile.language);
    } catch (error) {
        console.error('Error fetching first day of week setting:', error);
        // Default fallback based on browser locale
        return getLocaleFirstDayOfWeek(navigator.language);
    }
};

/**
 * Returns the first day of week based on locale/language
 * 0 = Sunday, 1 = Monday, etc.
 */
export const getLocaleFirstDayOfWeek = (locale: string): number => {
    // Countries that typically start with Monday (1)
    const mondayCountries = [
        'de',
        'fr',
        'es',
        'it',
        'nl',
        'pt',
        'ru',
        'pl',
        'no',
        'da',
        'sv',
        'fi',
        'el',
        'tr',
        'bg',
        'ro',
        'hu',
        'cs',
        'sk',
        'hr',
        'sl',
        'et',
        'lv',
        'lt',
        'uk',
        'be',
        'at',
        'ch',
        'lu',
        'is',
        'ie',
        'gb',
        'eu',
        'zh',
        'ja',
        'ko',
    ];

    // Countries that typically start with Saturday (6)
    const saturdayCountries = ['ar', 'he', 'fa'];

    // Extract language code (e.g., 'en-US' -> 'en', 'zh-CN' -> 'zh')
    const langCode = locale.toLowerCase().split('-')[0];

    if (saturdayCountries.includes(langCode)) {
        return 6; // Saturday
    } else if (mondayCountries.includes(langCode)) {
        return 1; // Monday
    } else {
        return 0; // Sunday (default for US, CA, JP, etc.)
    }
};
