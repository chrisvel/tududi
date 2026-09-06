// Public counters for the proof bar: Docker Hub pulls and Discord members.
//
// Never fetched on the request path. A render reads whatever is cached and
// kicks off a refresh in the background; until the first fetch lands, or
// when it fails, the value is null and the page omits the item rather than
// printing a number that has gone stale.

const TTL_MS = 6 * 60 * 60 * 1000;
const DISCORD_INVITE_CODE = 'fkbeJ9CmcH';

const entries = {
    dockerPulls: { value: null, fetchedAt: 0, inflight: null },
    discordMembers: { value: null, fetchedAt: 0, inflight: null },
};

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

const fetchers = {
    dockerPulls: async () => {
        const data = await fetchJson(
            'https://hub.docker.com/v2/repositories/chrisvel/tududi/'
        );
        return data && typeof data.pull_count === 'number'
            ? data.pull_count
            : null;
    },
    // The invite endpoint rather than the guild widget: the widget is
    // disabled on the tududi server and answers 403.
    discordMembers: async () => {
        const data = await fetchJson(
            `https://discord.com/api/v10/invites/${DISCORD_INVITE_CODE}?with_counts=true`
        );
        return data && typeof data.approximate_member_count === 'number'
            ? data.approximate_member_count
            : null;
    },
};

function refresh(name) {
    const entry = entries[name];
    if (entry.inflight || Date.now() - entry.fetchedAt < TTL_MS) return;
    entry.inflight = fetchers[name]()
        .then((value) => {
            if (value !== null) entry.value = value;
            entry.fetchedAt = Date.now();
        })
        .catch(() => {
            // Try again on the next render rather than after a full TTL
            entry.fetchedAt = Date.now() - TTL_MS + 60 * 1000;
        })
        .finally(() => {
            entry.inflight = null;
        });
}

// Returns the cached values and schedules a refresh when they are stale.
// Disabled under test so the suite never touches the network.
function getStats() {
    if (process.env.NODE_ENV !== 'test') {
        refresh('dockerPulls');
        refresh('discordMembers');
    }
    return {
        dockerPulls: entries.dockerPulls.value,
        discordMembers: entries.discordMembers.value,
    };
}

module.exports = { getStats };
