const xml2js = require('xml2js');

const xmlBuilder = new xml2js.Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { pretty: true, indent: '  ' },
});

const xmlParser = new xml2js.Parser({
    explicitArray: false,
    explicitRoot: true,
    ignoreAttrs: false,
    mergeAttrs: true,
    xmlns: true,
});

function buildMultistatus(responses) {
    const multistatus = {
        'D:multistatus': {
            $: {
                'xmlns:D': 'DAV:',
                'xmlns:C': 'urn:ietf:params:xml:ns:caldav',
            },
            'D:response': responses,
        },
    };

    return xmlBuilder.buildObject(multistatus);
}

function buildResponse(href, propstats) {
    return {
        'D:href': href,
        'D:propstat': propstats,
    };
}

function buildPropstat(props, status = 'HTTP/1.1 200 OK') {
    return {
        'D:prop': props,
        'D:status': status,
    };
}

function buildProp(name, value, namespace = 'D') {
    return { [`${namespace}:${name}`]: value };
}

function buildError(errorType, description) {
    return {
        'D:error': {
            $: { 'xmlns:D': 'DAV:' },
            [`D:${errorType}`]: description || '',
        },
    };
}

function parseCalendarQuery(xmlString) {
    return new Promise((resolve, reject) => {
        xmlParser.parseString(xmlString, (err, result) => {
            if (err) {
                return reject(err);
            }

            try {
                const query =
                    result['C:calendar-query'] || result['calendar-query'];
                const filter = query?.['C:filter'] || query?.filter;
                const compFilter =
                    filter?.['C:comp-filter'] || filter?.['comp-filter'];

                const extractValue = (attr) => {
                    if (!attr) return null;
                    return typeof attr === 'string' ? attr : attr.value;
                };

                const parsedQuery = {
                    props: [],
                    filters: {
                        componentType: extractValue(compFilter?.name) || 'VTODO',
                        timeRange: null,
                        textMatch: null,
                    },
                };

                if (compFilter) {
                    const timeRange =
                        compFilter['C:time-range'] || compFilter['time-range'];
                    if (timeRange) {
                        parsedQuery.filters.timeRange = {
                            start: extractValue(timeRange.start),
                            end: extractValue(timeRange.end),
                        };
                    }

                    const propFilter =
                        compFilter['C:prop-filter'] ||
                        compFilter['prop-filter'];
                    if (propFilter) {
                        const textMatch =
                            propFilter['C:text-match'] ||
                            propFilter['text-match'];
                        if (textMatch) {
                            parsedQuery.filters.textMatch = {
                                property: extractValue(propFilter.name),
                                value:
                                    typeof textMatch === 'string'
                                        ? textMatch
                                        : textMatch._,
                                caseless:
                                    extractValue(textMatch['collation']) ===
                                    'i;unicode-casefold',
                            };
                        }
                    }
                }

                const prop = query?.['D:prop'] || query?.prop;
                if (prop) {
                    parsedQuery.props = Object.keys(prop).map((key) =>
                        key.replace(/^[^:]+:/, '')
                    );
                }

                resolve(parsedQuery);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

function parsePropfind(xmlString) {
    return new Promise((resolve, reject) => {
        xmlParser.parseString(xmlString, (err, result) => {
            if (err) {
                return reject(err);
            }

            try {
                const propfind = result['D:propfind'] || result.propfind;

                if (propfind['D:allprop'] || propfind.allprop) {
                    return resolve({ type: 'allprop' });
                }

                if (propfind['D:propname'] || propfind.propname) {
                    return resolve({ type: 'propname' });
                }

                const prop = propfind['D:prop'] || propfind.prop;
                if (prop) {
                    const requestedProps = Object.keys(prop).map((key) => {
                        const [namespace, name] = key.split(':').reverse();
                        return {
                            name: name || namespace,
                            namespace: name ? namespace : 'D',
                        };
                    });

                    return resolve({ type: 'prop', props: requestedProps });
                }

                resolve({ type: 'allprop' });
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

function buildCalendarData(vtodoString) {
    return {
        'C:calendar-data': {
            _: vtodoString,
            $: { 'xmlns:C': 'urn:ietf:params:xml:ns:caldav' },
        },
    };
}

function buildHref(username, taskUid = null) {
    const base = `/caldav/${encodeURIComponent(username)}/tasks/`;
    return taskUid ? `${base}${encodeURIComponent(taskUid)}.ics` : base;
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') {
        return unsafe;
    }

    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    xmlBuilder,
    xmlParser,
    buildMultistatus,
    buildResponse,
    buildPropstat,
    buildProp,
    buildError,
    buildCalendarData,
    buildHref,
    parseCalendarQuery,
    parsePropfind,
    escapeXml,
};
