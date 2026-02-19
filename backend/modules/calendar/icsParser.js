'use strict';

const DEFAULT_MAX_EVENTS = 5000;

const unfoldLines = (icsText) => {
    const rawLines = (icsText || '').split(/\r?\n/);
    const lines = [];

    rawLines.forEach((line) => {
        if (!line) {
            lines.push('');
            return;
        }

        const firstChar = line[0];
        if ((firstChar === ' ' || firstChar === '\t') && lines.length > 0) {
            lines[lines.length - 1] += line.slice(1);
        } else {
            lines.push(line);
        }
    });

    return lines;
};

const unescapeText = (value) =>
    value
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');

const parseDateTime = (value) => {
    const dateTimeMatch = value.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/
    );
    if (dateTimeMatch) {
        const [, year, month, day, hour, minute, second] = dateTimeMatch;
        const date = new Date(
            Date.UTC(
                Number.parseInt(year, 10),
                Number.parseInt(month, 10) - 1,
                Number.parseInt(day, 10),
                Number.parseInt(hour, 10),
                Number.parseInt(minute, 10),
                Number.parseInt(second, 10)
            )
        );
        return { date, isDateOnly: false };
    }

    const shortMatch = value.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(Z)?$/
    );
    if (shortMatch) {
        const [, year, month, day, hour, minute] = shortMatch;
        const date = new Date(
            Date.UTC(
                Number.parseInt(year, 10),
                Number.parseInt(month, 10) - 1,
                Number.parseInt(day, 10),
                Number.parseInt(hour, 10),
                Number.parseInt(minute, 10),
                0
            )
        );
        return { date, isDateOnly: false };
    }

    return null;
};

const parseDateValue = (value) => {
    const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!dateMatch) {
        return null;
    }
    const [, year, month, day] = dateMatch;
    const date = new Date(
        Date.UTC(
            Number.parseInt(year, 10),
            Number.parseInt(month, 10) - 1,
            Number.parseInt(day, 10),
            0,
            0,
            0
        )
    );
    return { date, isDateOnly: true };
};

const parseIcsDate = (value) => {
    const dateOnly = parseDateValue(value);
    if (dateOnly) {
        return dateOnly;
    }
    return parseDateTime(value);
};

const parseDuration = (value) => {
    const match = value.match(
        /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
    );
    if (!match) {
        return null;
    }

    const [, sign, weeks, days, hours, minutes, seconds] = match;
    const totalSeconds =
        Number.parseInt(weeks || '0', 10) * 7 * 24 * 60 * 60 +
        Number.parseInt(days || '0', 10) * 24 * 60 * 60 +
        Number.parseInt(hours || '0', 10) * 60 * 60 +
        Number.parseInt(minutes || '0', 10) * 60 +
        Number.parseInt(seconds || '0', 10);

    const multiplier = sign === '-' ? -1 : 1;
    return totalSeconds * 1000 * multiplier;
};

const finalizeEvent = (events, currentEvent, maxEvents) => {
    if (!currentEvent || events.length >= maxEvents) {
        return;
    }

    if (currentEvent.status === 'CANCELLED') {
        return;
    }

    if (!currentEvent.startsAt) {
        return;
    }

    let endsAt = null;
    if (currentEvent.endsAt) {
        endsAt = currentEvent.endsAt;
    } else if (Number.isFinite(currentEvent.durationMs)) {
        endsAt = new Date(
            currentEvent.startsAt.getTime() + currentEvent.durationMs
        );
    }

    if (!endsAt) {
        return;
    }

    events.push({
        ical_uid: currentEvent.uid || null,
        title: currentEvent.title || '',
        starts_at: currentEvent.startsAt,
        ends_at: endsAt,
        all_day: Boolean(currentEvent.allDay),
        location: currentEvent.location || '',
        description: currentEvent.description || '',
    });
};

const parseIcs = (icsText, options = {}) => {
    const maxEvents = Number.isInteger(options.maxEvents)
        ? options.maxEvents
        : DEFAULT_MAX_EVENTS;
    const events = [];
    const lines = unfoldLines(icsText);
    let currentEvent = null;
    let inEvent = false;

    for (const line of lines) {
        if (events.length >= maxEvents) {
            break;
        }

        if (!line) {
            continue;
        }

        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }

        const rawName = line.slice(0, separatorIndex);
        const value = line.slice(separatorIndex + 1);
        const property = rawName.split(';')[0].toUpperCase();

        if (property === 'BEGIN' && value === 'VEVENT') {
            inEvent = true;
            currentEvent = {
                uid: null,
                title: null,
                location: null,
                description: null,
                status: null,
                startsAt: null,
                endsAt: null,
                durationMs: null,
                allDay: false,
            };
            continue;
        }

        if (property === 'END' && value === 'VEVENT') {
            if (inEvent) {
                finalizeEvent(events, currentEvent, maxEvents);
            }
            inEvent = false;
            currentEvent = null;
            continue;
        }

        if (!inEvent || !currentEvent) {
            continue;
        }

        switch (property) {
            case 'UID':
                currentEvent.uid = value.trim();
                break;
            case 'SUMMARY':
                currentEvent.title = unescapeText(value.trim());
                break;
            case 'LOCATION':
                currentEvent.location = unescapeText(value.trim());
                break;
            case 'DESCRIPTION':
                currentEvent.description = unescapeText(value.trim());
                break;
            case 'STATUS':
                currentEvent.status = value.trim().toUpperCase();
                break;
            case 'DTSTART': {
                const parsed = parseIcsDate(value.trim());
                if (parsed) {
                    currentEvent.startsAt = parsed.date;
                    currentEvent.allDay = parsed.isDateOnly;
                }
                break;
            }
            case 'DTEND': {
                const parsed = parseIcsDate(value.trim());
                if (parsed) {
                    currentEvent.endsAt = parsed.date;
                }
                break;
            }
            case 'DURATION': {
                const durationMs = parseDuration(value.trim());
                if (durationMs !== null) {
                    currentEvent.durationMs = durationMs;
                }
                break;
            }
            default:
                break;
        }
    }

    return events;
};

module.exports = {
    parseIcs,
};
