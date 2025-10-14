import { User } from '../entities/User';

const CURRENT_USER_KEY = 'currentUser';

export const getCurrentUser = (): User | null => {
    try {
        const userJson = localStorage.getItem(CURRENT_USER_KEY);
        if (!userJson) return null;
        return JSON.parse(userJson) as User;
    } catch (error) {
        console.error('Error getting current user from localStorage:', error);
        return null;
    }
};

export const setCurrentUser = (user: User | null): void => {
    try {
        if (user) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    } catch (error) {
        console.error('Error setting current user in localStorage:', error);
    }
};

export const clearCurrentUser = (): void => {
    try {
        localStorage.removeItem(CURRENT_USER_KEY);
    } catch (error) {
        console.error('Error clearing current user from localStorage:', error);
    }
};
