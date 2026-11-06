const ICAL = require('ical.js');
const moment = require('moment-timezone');
const { isValidTimezone } = require('../../../utils/timezone-utils');

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// The instant as wall-clock time in the zone, or null when the zone cannot
// carry it: no usable zone (UTC needs no TZID), or the repeated hour at the end
// of DST, where a local time reads back as the first of the two instants.
function toZonedTime(date, timezone) {
    if (!timezone || timezone === 'UTC' || !isValidTimezone(timezone)) {
        return null;
    }
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const local = moment.tz(date, timezone);
    const wallClock = local.format('YYYY-MM-DDTHH:mm:ss');
    const readBack = moment.tz(wallClock, timezone);
    if (readBack.unix() !== local.unix()) {
        return null;
    }

    return new ICAL.Time({
        year: local.year(),
        month: local.month() + 1,
        day: local.date(),
        hour: local.hour(),
        minute: local.minute(),
        second: local.second(),
        isDate: false,
    });
}

function offsetValue(mins) {
    // moment-timezone stores offsets as minutes behind UTC.
    return ICAL.UtcOffset.fromSeconds(Math.round(-mins * 60));
}

function buildObservance(zone, index, timezone) {
    const startsAt = index > 0 ? zone.untils[index - 1] : null;
    const offset = zone.offsets[index];
    const previousOffset = index > 0 ? zone.offsets[index - 1] : offset;
    const isDaylight =
        startsAt !== null && moment.tz(startsAt, timezone).isDST();

    const observance = new ICAL.Component(isDaylight ? 'daylight' : 'standard');

    // An observance's DTSTART is local time in the offset it replaces.
    const dtstart =
        startsAt === null
            ? new ICAL.Time({
                  year: 1970,
                  month: 1,
                  day: 1,
                  hour: 0,
                  minute: 0,
                  second: 0,
                  isDate: false,
              })
            : (() => {
                  const wallClock = moment
                      .utc(startsAt)
                      .utcOffset(-previousOffset);
                  return new ICAL.Time({
                      year: wallClock.year(),
                      month: wallClock.month() + 1,
                      day: wallClock.date(),
                      hour: wallClock.hour(),
                      minute: wallClock.minute(),
                      second: wallClock.second(),
                      isDate: false,
                  });
              })();

    observance.addPropertyWithValue('dtstart', dtstart);
    observance.addPropertyWithValue(
        'tzoffsetfrom',
        offsetValue(previousOffset)
    );
    observance.addPropertyWithValue('tzoffsetto', offsetValue(offset));
    if (zone.abbrs[index]) {
        observance.addPropertyWithValue('tzname', zone.abbrs[index]);
    }

    return observance;
}

// A VTIMEZONE covering the given instants, plus a year past the last one so a
// client expanding a repeating task still has the offsets it needs.
function buildVTimezone(timezone, instants) {
    const zone = moment.tz.zone(timezone);
    if (!zone || instants.length === 0) {
        return null;
    }

    const times = instants.map((date) => date.getTime());
    const coverFrom = Math.min(...times);
    const coverTo = Math.max(...times) + ONE_YEAR_MS;

    const vtimezone = new ICAL.Component('vtimezone');
    vtimezone.addPropertyWithValue('tzid', timezone);

    // untils[i] is the moment observance i ends, the last one being Infinity.
    zone.untils.forEach((until, index) => {
        const startsAt = index > 0 ? zone.untils[index - 1] : -Infinity;
        if (until > coverFrom && startsAt <= coverTo) {
            vtimezone.addSubcomponent(buildObservance(zone, index, timezone));
        }
    });

    return vtimezone;
}

module.exports = {
    toZonedTime,
    buildVTimezone,
};
