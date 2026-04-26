const STATUS_TASKNOTETAKER_TO_ICAL = {
    0: 'NEEDS-ACTION',
    1: 'IN-PROCESS',
    2: 'COMPLETED',
    3: 'COMPLETED',
    4: 'NEEDS-ACTION',
    5: 'CANCELLED',
    6: 'NEEDS-ACTION',
};

const STATUS_ICAL_TO_TASKNOTETAKER = {
    'NEEDS-ACTION': 0,
    'IN-PROCESS': 1,
    COMPLETED: 2,
    CANCELLED: 5,
};

function tasknotetakerToIcalPriority(priority) {
    if (priority === null || priority === undefined) {
        return 0;
    }

    if (priority === 0) return 7;
    if (priority === 1) return 5;
    if (priority === 2) return 3;
    return 0;
}

function icalToTaskNoteTakerPriority(priority) {
    if (!priority || priority === 0) {
        return 0;
    }

    if (priority <= 3) {
        return 2;
    }
    if (priority <= 6) {
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
    STATUS_TASKNOTETAKER_TO_ICAL,
    STATUS_ICAL_TO_TASKNOTETAKER,
    tasknotetakerToIcalPriority,
    icalToTaskNoteTakerPriority,
    WEEKDAY_MAP,
    WEEKDAY_REVERSE_MAP,
};
