'use strict';

// Reads the tag history and works out what the next version would be on each
// channel. Prints shell assignments so create-version.sh can `eval` it.
//
// Ordering lives here rather than in the shell because `sort -V` gets
// pre-releases wrong: 1.5.0-rc.7 has to sort *below* 1.5.0, and rc.10 above
// rc.9. Both are ordinary comparisons once the tag is parsed.

const { execFileSync } = require('child_process');

const TAG = /^v(\d+)\.(\d+)\.(\d+)(?:-(rc|dev)\.(\d+))?$/;

function parse(tag) {
    const m = TAG.exec(tag);
    if (!m) return null;
    return {
        tag,
        major: Number(m[1]),
        minor: Number(m[2]),
        patch: Number(m[3]),
        channel: m[4] || 'stable',
        number: m[5] ? Number(m[5]) : 0,
    };
}

function compareRelease(a, b) {
    return (
        a.major - b.major ||
        a.minor - b.minor ||
        a.patch - b.patch ||
        a.number - b.number
    );
}

// Is this release for a version that has not shipped as stable yet?
function isAhead(pre, stable) {
    if (!pre) return false;
    if (!stable) return true;
    return (
        (pre.major - stable.major ||
            pre.minor - stable.minor ||
            pre.patch - stable.patch) > 0
    );
}

function base(v) {
    return `${v.major}.${v.minor}.${v.patch}`;
}

function nextPatch(v) {
    return v ? `${v.major}.${v.minor}.${v.patch + 1}` : '0.1.0';
}

const tags = execFileSync('git', ['tag', '--list', 'v*'], {
    encoding: 'utf8',
})
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parse)
    .filter(Boolean);

const newest = (channel) => {
    const of = tags.filter((t) => t.channel === channel);
    return of.length ? of.sort(compareRelease)[of.length - 1] : null;
};

const stable = newest('stable');
const rc = newest('rc');
const dev = newest('dev');

// The version currently in flight: the highest base that has pre-releases but
// has not shipped as stable. While 1.5.0 is in RC, a first dev build belongs
// on 1.5.0 too, not on an invented 1.4.3 line.
const inFlight = [rc, dev]
    .filter((v) => isAhead(v, stable))
    .sort(compareRelease)
    .pop();

// A pre-release channel continues the line it is already on when that line is
// ahead of the last stable release; otherwise it joins the version in flight,
// and failing that opens a new patch line.
function nextPre(channel, latest) {
    if (isAhead(latest, stable)) {
        return `v${base(latest)}-${channel}.${latest.number + 1}`;
    }
    if (inFlight) {
        return `v${base(inFlight)}-${channel}.1`;
    }
    return `v${nextPatch(stable)}-${channel}.1`;
}

// Going stable promotes whichever pre-release line is furthest along, so
// 1.5.0-rc.7 becomes 1.5.0 rather than inventing a number.
const promote = inFlight || null;

const out = {
    LATEST_STABLE: stable ? stable.tag : '',
    LATEST_RC: rc ? rc.tag : '',
    LATEST_DEV: dev ? dev.tag : '',
    NEXT_STABLE: promote ? `v${base(promote)}` : `v${nextPatch(stable)}`,
    NEXT_RC: nextPre('rc', rc),
    NEXT_DEV: nextPre('dev', dev),
};

for (const [key, value] of Object.entries(out)) {
    process.stdout.write(`${key}='${value}'\n`);
}
