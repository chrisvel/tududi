import React from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchFocusToday, focusKeys } from '../../utils/todayService';
import { resolveDisplayLocale } from '../../utils/jalali';
export default function FocusTodayLine() {
    const { t, i18n } = useTranslation();
    const { data } = useSWR(focusKeys.today, fetchFocusToday);
    if (!data?.spent_minutes) return null;
    return (
        <p className="text-sm text-secondary" data-testid="focus-today">
            {t('taskPomodoro.today', 'Today: {{minutes}} focus minutes', {
                minutes: new Intl.NumberFormat(
                    resolveDisplayLocale(i18n.language)
                ).format(data.spent_minutes),
            })}
        </p>
    );
}
