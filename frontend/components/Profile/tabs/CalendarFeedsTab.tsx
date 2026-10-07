import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import CalendarFeedsManager from '../../CalendarFeeds/CalendarFeedsManager';
import {
    CalendarFeed,
    fetchCalendarFeeds,
} from '../../../utils/calendarFeedsService';

interface CalendarFeedsTabProps {
    isActive: boolean;
}

const CalendarFeedsTab: React.FC<CalendarFeedsTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isActive) return;
        setLoading(true);
        fetchCalendarFeeds()
            .then(setFeeds)
            .catch(() =>
                showErrorToast(
                    t('profile.calendars.loadError', 'Could not load calendars')
                )
            )
            .finally(() => setLoading(false));
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div>
            <h3 className="mb-6 flex items-center text-xl font-semibold text-gray-900 dark:text-white">
                <CalendarDaysIcon className="mr-3 h-6 w-6 text-blue-500" />
                {t('profile.calendars.title', 'Calendars')}
            </h3>

            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                {t(
                    'profile.calendars.description',
                    'Show your meetings next to your day plan and on the Calendar page. Tududi only reads these calendars; it never changes them.'
                )}
            </p>

            <CalendarFeedsManager
                feeds={feeds}
                loading={loading}
                onFeedsChange={(update) => setFeeds(update)}
            />
        </div>
    );
};

export default CalendarFeedsTab;
