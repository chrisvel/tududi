'use strict';

const moment = require('moment-timezone');
const { serializeTasks } = require('../../tasks/core/serializers');

const BUCKET_KEYS = ['overdue', 'today', 'tomorrow', 'upcoming', 'no_date'];

function emptyBuckets() {
    return {
        overdue: [],
        today: [],
        tomorrow: [],
        upcoming: [],
        no_date: [],
    };
}

function bucketForDue(dueDate, tz) {
    if (!dueDate) return 'no_date';
    const due = moment.utc(dueDate).tz(tz).startOf('day');
    const today = moment.tz(tz).startOf('day');
    const diff = due.diff(today, 'days');
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    if (diff <= 7) return 'upcoming';
    return null; // more than a week out - not shown on the board
}

// At-a-glance totals for the stats row on the Everyone page. Derived from the
// finished columns so the numbers always match what the board shows.
function summarize(columns) {
    let total = 0;
    let overdue = 0;
    let today = 0;
    for (const col of columns) {
        for (const key of BUCKET_KEYS) total += col.counts[key];
        overdue += col.counts.overdue;
        today += col.counts.today;
    }
    return { people: columns.length, total, overdue, today };
}

async function buildColumns(
    tasks,
    userId,
    userIdToSelfPersonUid,
    personByUid,
    personUidAlias,
    tz
) {
    const selfPersonUid = userIdToSelfPersonUid[userId] || null;

    // personUid -> { raw buckets }
    const byPerson = new Map();
    const ensure = (personUid) => {
        if (!byPerson.has(personUid)) byPerson.set(personUid, emptyBuckets());
        return byPerson.get(personUid);
    };

    // Every account person gets a column even with no tasks.
    for (const uid of Object.values(userIdToSelfPersonUid)) ensure(uid);

    for (const task of tasks) {
        const assignedUid = task.assigned_to
            ? personUidAlias[task.assigned_to] || task.assigned_to
            : null;
        const personUid =
            assignedUid || userIdToSelfPersonUid[task.user_id] || null;
        if (!personUid) continue;
        const bucket = bucketForDue(task.due_date, tz);
        if (!bucket) continue;
        ensure(personUid)[bucket].push(task);
    }

    const columns = [];
    for (const [personUid, buckets] of byPerson.entries()) {
        const person = personByUid[personUid];
        if (!person) continue;
        const isSelf = personUid === selfPersonUid;
        const total = BUCKET_KEYS.reduce((n, k) => n + buckets[k].length, 0);
        // Skip empty non-account people; keep empty account people.
        if (total === 0 && !person.linked_user_id && !isSelf) continue;

        const serialized = {};
        const counts = {};
        for (const key of BUCKET_KEYS) {
            // A recurring task is shown by its own name, not by its pattern
            // ("Daily", "Weekly"), since the board lists what to do.
            serialized[key] = await serializeTasks(buckets[key], tz, {
                preserveOriginalName: true,
            });
            counts[key] = buckets[key].length;
        }

        columns.push({
            person: {
                uid: person.uid,
                name: person.name,
                color: person.color || null,
                relationship_type: person.relationship_type || null,
                linked_user_id: person.linked_user_id || null,
            },
            is_self: isSelf,
            counts,
            ...serialized,
        });
    }

    columns.sort((a, b) => {
        if (a.is_self !== b.is_self) return a.is_self ? -1 : 1;
        const aLinked = a.person.linked_user_id != null;
        const bLinked = b.person.linked_user_id != null;
        if (aLinked !== bLinked) return aLinked ? -1 : 1;
        return a.person.name.localeCompare(b.person.name);
    });

    return columns;
}

module.exports = { BUCKET_KEYS, bucketForDue, summarize, buildColumns };
