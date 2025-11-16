import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
} from 'react';
import { getApiPath } from '../config/paths';

type TelegramStatus = 'healthy' | 'problem' | 'none';

interface TelegramStatusContextType {
    status: TelegramStatus;
    updateStatus: (newStatus: TelegramStatus) => void;
    refreshStatus: () => Promise<void>;
}

const TelegramStatusContext = createContext<
    TelegramStatusContextType | undefined
>(undefined);

export const TelegramStatusProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [status, setStatus] = useState<TelegramStatus>('none');

    const fetchTelegramStatus =
        useCallback(async (): Promise<TelegramStatus> => {
            try {
                // Check if user has telegram bot token
                const profileResponse = await fetch(getApiPath('profile'), {
                    credentials: 'include',
                });

                if (!profileResponse.ok) {
                    return 'none';
                }

                const profileData = await profileResponse.json();

                if (!profileData.telegram_bot_token) {
                    return 'none';
                }

                // Check polling status
                const pollingResponse = await fetch(
                    getApiPath('telegram/polling-status'),
                    {
                        credentials: 'include',
                    }
                );

                if (!pollingResponse.ok) {
                    return 'problem';
                }

                const pollingData = await pollingResponse.json();

                if (pollingData.status?.running) {
                    return 'healthy';
                } else {
                    return 'problem';
                }
            } catch (error) {
                console.error('Error fetching Telegram status:', error);
                return 'problem';
            }
        }, []);

    const refreshStatus = useCallback(async () => {
        const newStatus = await fetchTelegramStatus();
        setStatus(newStatus);
    }, [fetchTelegramStatus]);

    const updateStatus = useCallback((newStatus: TelegramStatus) => {
        setStatus(newStatus);
    }, []);

    // Initial fetch and periodic refresh
    useEffect(() => {
        refreshStatus();

        // Refresh every 30 seconds
        const interval = setInterval(refreshStatus, 30000);

        return () => clearInterval(interval);
    }, [refreshStatus]);

    // Listen for custom events to update status immediately
    useEffect(() => {
        const handleTelegramStatusChange = (
            event: CustomEvent<{ status: TelegramStatus }>
        ) => {
            setStatus(event.detail.status);
        };

        window.addEventListener(
            'telegramStatusChanged',
            handleTelegramStatusChange as EventListener
        );

        return () => {
            window.removeEventListener(
                'telegramStatusChanged',
                handleTelegramStatusChange as EventListener
            );
        };
    }, []);

    return (
        <TelegramStatusContext.Provider
            value={{ status, updateStatus, refreshStatus }}
        >
            {children}
        </TelegramStatusContext.Provider>
    );
};

export const useTelegramStatus = () => {
    const context = useContext(TelegramStatusContext);
    if (context === undefined) {
        throw new Error(
            'useTelegramStatus must be used within a TelegramStatusProvider'
        );
    }
    return context;
};

// Utility function to dispatch status change events
export const dispatchTelegramStatusChange = (status: TelegramStatus) => {
    window.dispatchEvent(
        new CustomEvent('telegramStatusChanged', { detail: { status } })
    );
};
