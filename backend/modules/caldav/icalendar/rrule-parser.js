const { WEEKDAY_REVERSE_MAP } = require('./field-mappings');

function parseRRULE(rruleString) {
    if (!rruleString) {
        return null;
    }

    try {
        const parts = rruleString.split(';');
        const rruleData = {};

        parts.forEach((part) => {
            const [key, value] = part.split('=');
            rruleData[key] = value;
        });

        const result = {
            recurrence_type: null,
            recurrence_interval: 1,
            recurrence_end_date: null,
            recurrence_weekdays: null,
            recurrence_month_day: null,
            recurrence_weekday: null,
            recurrence_week_of_month: null,
        };

        if (!rruleData.FREQ) {
            return null;
        }

        if (rruleData.INTERVAL) {
            result.recurrence_interval = parseInt(rruleData.INTERVAL, 10);
        }

        if (rruleData.UNTIL) {
            try {
                const until = rruleData.UNTIL;
                result.recurrence_end_date = new Date(
                    until.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z')
                );
            } catch (error) {
                console.error('Error parsing UNTIL:', error);
            }
        }

        switch (rruleData.FREQ) {
            case 'DAILY':
                result.recurrence_type = 'daily';
                break;

            case 'WEEKLY':
                result.recurrence_type = 'weekly';
                if (rruleData.BYDAY) {
                    const days = rruleData.BYDAY.split(',')
                        .map((day) => {
                            const cleanDay = day.replace(/[0-9-]/g, '');
                            return WEEKDAY_REVERSE_MAP[cleanDay];
                        })
                        .filter((d) => d !== undefined);
                    result.recurrence_weekdays = days;
                }
                break;

            case 'MONTHLY':
                if (rruleData.BYDAY) {
                    result.recurrence_type = 'monthly_weekday';
                    const byDayMatch = rruleData.BYDAY.match(/(-?\d+)([A-Z]{2})/);
                    if (byDayMatch) {
                        result.recurrence_week_of_month = parseInt(
                            byDayMatch[1],
                            10
                        );
                        result.recurrence_weekday =
                            WEEKDAY_REVERSE_MAP[byDayMatch[2]];
                    }
                } else if (rruleData.BYMONTHDAY === '-1') {
                    result.recurrence_type = 'monthly_last_day';
                } else if (rruleData.BYMONTHDAY) {
                    result.recurrence_type = 'monthly';
                    result.recurrence_month_day = parseInt(
                        rruleData.BYMONTHDAY,
                        10
                    );
                } else {
                    result.recurrence_type = 'monthly';
                }
                break;

            case 'YEARLY':
                result.recurrence_type = 'yearly';
                break;

            default:
                return null;
        }

        return result;
    } catch (error) {
        console.error('Error parsing RRULE:', error);
        return null;
    }
}

module.exports = {
    parseRRULE,
};
