import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export const saveSidebarWidthPercent = async (
    widthPercent: number
): Promise<void> => {
    const response = await fetch(getApiPath('profile/sidebar-settings'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
            Accept: 'application/json',
        },
        body: JSON.stringify({ widthPercent }),
    });
    if (!response.ok) {
        throw new Error(`Saving the sidebar width failed (${response.status})`);
    }
};
