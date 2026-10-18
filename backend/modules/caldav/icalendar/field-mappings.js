const STATUS_TUDUDI_TO_ICAL = {
    0: 'NEEDS-ACTION',
    1: 'IN-PROCESS',
    2: 'COMPLETED',
    3: 'COMPLETED',
    4: 'NEEDS-ACTION',
    5: 'CANCELLED',
    6: 'NEEDS-ACTION',
};

const STATUS_ICAL_TO_TUDUDI = {
    'NEEDS-ACTION': 0,
    'IN-PROCESS': 1,
    COMPLETED: 2,
    CANCELLED: 5,
};

// RFC 5545 3.8.1.9: 1-4 is high, 5 is medium, 6-9 is low, and 0 (or no
// PRIORITY at all) is "undefined priority". Tududi has no priority of its own
// (NULL), so 0 must map to null and not to Low - otherwise a task created
// without a priority in Apple Reminders or 2Do becomes Low on the way in and
// comes back to every client as PRIORITY:7.
function tududiToIcalPriority(priority) {
    if (priority === null || priority === undefined) {
        return null;
    }

    if (priority === 0) return 7;
    if (priority === 1) return 5;
    if (priority === 2) return 3;
    return null;
}

function icalToTududiPriority(priority) {
    const value = Number(priority);

    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }

    if (value <= 4) {
        return 2;
    }
    if (value <= 6) {
        return 1;
    }
    return 0;
}

const WEEKDAY_MAP = {
    0: 'SU',
    1: 'MO',
    2: 'TU',
    3: 'WE',
    4: 'TH',
    5: 'FR',
    6: 'SA',
};

const WEEKDAY_REVERSE_MAP = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
};

module.exports = {
    STATUS_TUDUDI_TO_ICAL,
    STATUS_ICAL_TO_TUDUDI,
    tududiToIcalPriority,
    icalToTududiPriority,
    WEEKDAY_MAP,
    WEEKDAY_REVERSE_MAP,
};
