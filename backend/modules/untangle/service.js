'use strict';

const crypto = require('crypto');
const moment = require('moment-timezone');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');
const ai = require('../ai-assistant/service');
const { languageInstruction } = require('../daily-plan/ai');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const {
    AppError,
    ValidationError,
    ServiceUnavailableError,
} = require('../../shared/errors');

// Untangle turns a stranger's messy list into the structure tududi stores:
// areas, goals, projects, tasks, waiting-fors, habits and someday items,
// plus one thing for today, a few things to drop, a week of load and at
// most one question. Nothing is written anywhere: the result goes back to
// the browser inside a signed token, and only "Keep it" (see seed.js)
// turns that token into rows, once the person has an account.

const LIMITS = {
    text: 6000,
    imageBytes: 6 * 1024 * 1024,
    areas: 8,
    projects: 12,
    projectTasks: 6,
    items: 40,
    drop: 3,
    tips: 4,
    tags: 2,
    questions: 3,
    options: 4,
    answers: 3,
    title: 200,
    reason: 200,
};
const KINDS = ['task', 'waiting', 'habit', 'someday'];
const PERIODS = ['daily', 'weekly', 'monthly'];
const MINUTE_STEPS = [15, 30, 45, 60, 90, 120, 180, 240];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function untangleConfig() {
    return getConfig().untangle || {};
}

async function isUntangleEnabled() {
    if (untangleConfig().enabled !== true) return false;
    return ai.isAIConfigured(null);
}

// A whole-instance ceiling on parses per UTC day, so a burst from many
// addresses still cannot run up the provider bill. In memory: a restart
// resets it, which is fine for a safety net.
let dailyCounter = { day: null, count: 0 };

function takeDailySlot() {
    const day = moment.utc().format('YYYY-MM-DD');
    if (dailyCounter.day !== day) dailyCounter = { day, count: 0 };
    const cap = untangleConfig().dailyCap;
    if (Number.isFinite(cap) && cap > 0 && dailyCounter.count >= cap) {
        return false;
    }
    dailyCounter.count += 1;
    return true;
}

function resetDailyCounter() {
    dailyCounter = { day: null, count: 0 };
}

// ---------------------------------------------------------------------------
// Prompt and schema

const SYSTEM_PROMPT = `You turn one person's messy list into an organized life system in Tududi. The person pasted raw text, or a screenshot of a list. Sort every line into the structure below, decide what matters today, and be opinionated about what can wait.

Structure:
- areas: 2 to 6 life areas named from the person's own content (for example Home, Work, Health, Family, Money, Someday). Every item belongs to exactly one area.
- goal: when several items in an area clearly serve one outcome, name that outcome as the area's goal, with a short "why". Otherwise null. Never invent an outcome the content does not support.
- projects: anything that needs several steps becomes a project with 2 to 5 concrete tasks, each starting with a verb. Indented or grouped lines under a heading are a project. Trips, events, launches and anything with "plan" are usually projects.
- items: everything else, one per line, with a kind:
  - task: one concrete action.
  - waiting: something another person owes this person. Set person to that person's name.
  - habit: something repeated ("gym x3", "read every evening", "call mum on Sundays"). Set habit_period and habit_times.
  - someday: an intention with no urgency (wishes, "maybe", books to read, hobbies to start).
- person: the other person a line involves, when it names one ("dentist for Leo" names Leo, "call mum" names Mum, "ask Maria" names Maria). Otherwise null. Never invent names.
- tags: 0 to 2 short lowercase labels that would help filing, such as errand, call, admin, health, money, kids, home. Only when natural; most lines get none.
- due: YYYY-MM-DD only when the text names or clearly implies a date or deadline, resolved from today's date. Appointments and birthdays keep their date. Otherwise null.
- minutes: a realistic estimate for a task: 15, 30, 45, 60, 90, 120, 180 or 240. Errands and calls are short; writing and research take longer.
- today: the single best thing to do today, with one sentence on why. Prefer things another person is waiting on, things overdue, and things that unblock the most.
- drop: 1 to 3 things that can wait, each with a short reason. Pick from someday items and low-urgency tasks, using the exact titles you gave them.
- tips: 2 to 4 short, specific observations that help this person see their list differently, grounded in it: what is waiting on other people, what has no date yet, which day is overloaded, what repeats and could be a habit. At most 18 words each, no generic advice.
- questions: up to 3 questions whose answers would change the plan (for example whether a trip is this month or someday, or when a deadline is), each with 2 to 4 options of at most 4 words. Ask all of them now, in this one reply; there is no second round. Return an empty list when nothing important is unclear.

Rules:
- Use the person's own words for names. Fix spelling, drop noise like "!!", "??" and ":(".
- No dashes inside titles or reasons; split with a comma instead ("Birthday party Saturday 3pm, bring a gift").
- Do not invent items, people or dates. Do not merge unrelated lines.
- Every line of the input appears exactly once: as a project, a project's task, or an item. Never drop a line silently; drop means listing it under drop.
- When answers to earlier questions are given, apply them and return an empty questions list: the person has answered once and will not be asked again.
- Plain text, no markdown. Return only the JSON object.`;

const str = { type: 'string' };
const nullableStr = { type: ['string', 'null'] };
const int = { type: 'integer' };

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['today', 'drop', 'tips', 'questions', 'areas'],
    properties: {
        tips: { type: 'array', items: str },
        today: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'reason'],
            properties: { title: str, reason: str },
        },
        drop: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'reason'],
                properties: { title: str, reason: str },
            },
        },
        questions: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'options'],
                properties: {
                    text: str,
                    options: { type: 'array', items: str },
                },
            },
        },
        areas: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'goal', 'projects', 'items'],
                properties: {
                    name: str,
                    goal: {
                        type: ['object', 'null'],
                        additionalProperties: false,
                        required: ['title', 'why'],
                        properties: { title: str, why: str },
                    },
                    projects: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['name', 'tasks'],
                            properties: {
                                name: str,
                                tasks: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: [
                                            'title',
                                            'due',
                                            'minutes',
                                            'person',
                                            'tags',
                                        ],
                                        properties: {
                                            title: str,
                                            due: nullableStr,
                                            minutes: int,
                                            person: nullableStr,
                                            tags: {
                                                type: 'array',
                                                items: str,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: [
                                'title',
                                'kind',
                                'due',
                                'person',
                                'tags',
                                'minutes',
                                'habit_period',
                                'habit_times',
                            ],
                            properties: {
                                title: str,
                                kind: { type: 'string', enum: KINDS },
                                due: nullableStr,
                                person: nullableStr,
                                tags: { type: 'array', items: str },
                                minutes: int,
                                habit_period: {
                                    type: ['string', 'null'],
                                    enum: [...PERIODS, null],
                                },
                                habit_times: int,
                            },
                        },
                    },
                },
            },
        },
    },
};

// ---------------------------------------------------------------------------
// Input

function cleanText(value, max) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+$/g, '').trim().slice(0, max);
}

function parseImage(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') {
        throw new ValidationError('image must be a data URL');
    }
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match || !IMAGE_TYPES.includes(match[1])) {
        throw new ValidationError('image must be a PNG, JPEG or WebP data URL');
    }
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > LIMITS.imageBytes) {
        throw new ValidationError('image is too large (6 MB at most)');
    }
    return value;
}

function normalizeInput(body = {}) {
    const text = cleanText(body.text, LIMITS.text);
    const image = parseImage(body.image);
    if (!text && !image) {
        throw new ValidationError('Paste some text or a screenshot first');
    }
    const timezone = getSafeTimezone(
        typeof body.timezone === 'string' ? body.timezone : null
    );
    const language =
        typeof body.language === 'string' && /^[a-z]{2}$/.test(body.language)
            ? body.language
            : 'en';
    const answers = Array.isArray(body.answers)
        ? body.answers
              .filter(
                  (a) =>
                      a &&
                      typeof a.question === 'string' &&
                      typeof a.answer === 'string'
              )
              .slice(0, LIMITS.answers)
              .map((a) => ({
                  question: cleanText(a.question, LIMITS.reason),
                  answer: cleanText(a.answer, LIMITS.reason),
              }))
              .filter((a) => a.question && a.answer)
        : [];
    return { text, image, timezone, language, answers };
}

function buildUserMessage({ text, image, timezone, answers }) {
    const now = moment.tz(timezone);
    const lines = [
        `Today: ${now.format('YYYY-MM-DD')} (${now.format('dddd')}). Timezone: ${timezone}.`,
        '',
    ];
    if (image) {
        lines.push(
            "The person's list is in the attached screenshot. Read every line of it."
        );
        if (text) lines.push('', 'They also wrote:', text);
    } else {
        lines.push("The person's list:", text);
    }
    if (answers.length > 0) {
        lines.push('', 'Answers to earlier questions:');
        for (const a of answers) lines.push(`- ${a.question} ${a.answer}`);
    }
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Output

// Trims, caps and turns the dashes models love into commas.
function title(value, max = LIMITS.title) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/\s*[\u2013\u2014]\s*/g, ', ')
        .replace(/\s+-\s+/g, ', ')
        .trim()
        .slice(0, max);
}

function cleanDue(value, today) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    if (!moment(value, 'YYYY-MM-DD', true).isValid()) return null;
    return value < today ? today : value;
}

function cleanTags(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const tags = [];
    for (const raw of value) {
        if (typeof raw !== 'string') continue;
        const tag = raw.replace(/^#/, '').trim().toLowerCase().slice(0, 30);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        tags.push(tag);
        if (tags.length >= LIMITS.tags) break;
    }
    return tags;
}

function cleanPerson(value) {
    return title(value, 80) || null;
}

function cleanMinutes(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 30;
    let best = MINUTE_STEPS[0];
    for (const step of MINUTE_STEPS) {
        if (Math.abs(step - n) < Math.abs(best - n)) best = step;
    }
    return best;
}

function sanitizeResult(parsed, { timezone, answers = [] }) {
    const answered = answers.length;
    const today = moment.tz(timezone).format('YYYY-MM-DD');
    const rawAreas = Array.isArray(parsed?.areas) ? parsed.areas : [];
    const seenAreas = new Set();
    let projectCount = 0;
    let itemCount = 0;
    const titles = new Set();

    const areas = [];
    for (const raw of rawAreas) {
        if (areas.length >= LIMITS.areas) break;
        const name = title(raw?.name, 60);
        if (!name || seenAreas.has(name.toLowerCase())) continue;
        seenAreas.add(name.toLowerCase());

        const goal =
            raw?.goal && title(raw.goal.title)
                ? {
                      title: title(raw.goal.title),
                      why: title(raw.goal.why, 500),
                  }
                : null;

        const projects = [];
        for (const p of Array.isArray(raw?.projects) ? raw.projects : []) {
            if (projectCount >= LIMITS.projects) break;
            const pname = title(p?.name);
            if (!pname) continue;
            const tasks = [];
            for (const t of Array.isArray(p?.tasks) ? p.tasks : []) {
                if (tasks.length >= LIMITS.projectTasks) break;
                const ttitle = title(t?.title);
                if (!ttitle) continue;
                tasks.push({
                    title: ttitle,
                    due: cleanDue(t?.due, today),
                    minutes: cleanMinutes(t?.minutes),
                    person: cleanPerson(t?.person),
                    tags: cleanTags(t?.tags),
                });
                titles.add(ttitle.toLowerCase());
            }
            projects.push({ name: pname, tasks });
            projectCount += 1;
        }

        const items = [];
        for (const it of Array.isArray(raw?.items) ? raw.items : []) {
            if (itemCount >= LIMITS.items) break;
            const ititle = title(it?.title);
            if (!ititle) continue;
            const kind = KINDS.includes(it?.kind) ? it.kind : 'task';
            const item = {
                title: ititle,
                kind,
                due: kind === 'someday' ? null : cleanDue(it?.due, today),
                person: cleanPerson(it?.person),
                tags: cleanTags(it?.tags),
                minutes: cleanMinutes(it?.minutes),
                habit_period:
                    kind === 'habit' && PERIODS.includes(it?.habit_period)
                        ? it.habit_period
                        : kind === 'habit'
                          ? 'weekly'
                          : null,
                habit_times:
                    kind === 'habit'
                        ? Math.min(
                              Math.max(
                                  Math.round(Number(it?.habit_times)) || 1,
                                  1
                              ),
                              31
                          )
                        : null,
            };
            items.push(item);
            titles.add(ititle.toLowerCase());
            itemCount += 1;
        }

        if (projects.length === 0 && items.length === 0) continue;
        areas.push({ name, goal, projects, items });
    }

    if (areas.length === 0) {
        throw new AppError(
            'The AI could not make sense of that. Try pasting it as text.',
            502,
            'AI_NO_ANSWER'
        );
    }

    const todayPick = {
        title: title(parsed?.today?.title),
        reason: title(parsed?.today?.reason, LIMITS.reason),
    };
    if (!todayPick.title) {
        const first = areas
            .flatMap((a) => [
                ...a.items.filter((i) => i.kind === 'task'),
                ...a.projects.flatMap((p) => p.tasks),
            ])
            .sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))[0];
        todayPick.title = first ? first.title : '';
    }

    const drop = [];
    for (const d of Array.isArray(parsed?.drop) ? parsed.drop : []) {
        if (drop.length >= LIMITS.drop) break;
        const dtitle = title(d?.title);
        if (!dtitle) continue;
        drop.push({ title: dtitle, reason: title(d?.reason, LIMITS.reason) });
    }

    // One round only: once the person has answered, nothing more is asked,
    // whatever the model says.
    const questions = [];
    if (answered === 0) {
        for (const q of Array.isArray(parsed?.questions)
            ? parsed.questions
            : []) {
            if (questions.length >= LIMITS.questions) break;
            const text = title(q?.text, LIMITS.reason);
            const options = Array.isArray(q?.options)
                ? [...new Set(q.options.map((o) => title(o, 60)))]
                      .filter(Boolean)
                      .slice(0, LIMITS.options)
                : [];
            if (text && options.length >= 2) questions.push({ text, options });
        }
    }

    const tips = [];
    for (const tip of Array.isArray(parsed?.tips) ? parsed.tips : []) {
        if (tips.length >= LIMITS.tips) break;
        const text = title(tip, 220);
        if (text) tips.push(text);
    }

    return {
        today: todayPick,
        drop,
        tips,
        questions,
        areas,
        people: collectPeople(areas),
        week: buildWeek(areas, timezone),
    };
}

// Everyone the list mentions, with what they are tied to, so the page can
// show a People section and Keep it can create them once each.
function collectPeople(areas) {
    const byName = new Map();
    for (const area of areas) {
        const entries = [
            ...area.projects.flatMap((p) => p.tasks.map((t) => [t, 'task'])),
            ...area.items.map((it) => [it, it.kind]),
        ];
        for (const [entry, kind] of entries) {
            if (!entry.person) continue;
            const key = entry.person.toLowerCase();
            if (!byName.has(key)) {
                byName.set(key, { name: entry.person, items: [], waiting: 0 });
            }
            const person = byName.get(key);
            person.items.push(entry.title);
            if (kind === 'waiting') person.waiting += 1;
        }
    }
    return [...byName.values()];
}

// Seven days of load, in minutes. Dated work lands on its day (overdue on
// today); undated tasks fill the lightest day in turn; habits, waiting-fors
// and someday items cost no time. Nothing clever, it just makes "Monday is
// not carrying fourteen things" visible.
function buildWeek(areas, timezone) {
    const start = moment.tz(timezone).startOf('day');
    const days = [];
    for (let i = 0; i < 7; i += 1) {
        const d = start.clone().add(i, 'days');
        days.push({
            date: d.format('YYYY-MM-DD'),
            weekday: d.format('ddd'),
            minutes: 0,
            titles: [],
        });
    }
    const last = days[6].date;
    const dated = [];
    const undated = [];
    for (const area of areas) {
        for (const p of area.projects) {
            for (const t of p.tasks) (t.due ? dated : undated).push(t);
        }
        for (const it of area.items) {
            if (it.kind !== 'task') continue;
            (it.due ? dated : undated).push(it);
        }
    }
    for (const t of dated) {
        if (t.due > last) continue;
        const day = days.find((d) => d.date === t.due) || days[0];
        day.minutes += t.minutes;
        day.titles.push(t.title);
    }
    undated.sort((a, b) => b.minutes - a.minutes);
    for (const t of undated) {
        const day = days.reduce((best, d) =>
            d.minutes < best.minutes ? d : best
        );
        day.minutes += t.minutes;
        day.titles.push(t.title);
    }
    return days;
}

// ---------------------------------------------------------------------------
// The call

function visionModel(defaultModel) {
    return process.env.LLM_VISION_MODEL || defaultModel;
}

async function untangle(body) {
    if (!(await isUntangleEnabled())) {
        throw new ServiceUnavailableError('Untangle is not available');
    }
    const input = normalizeInput(body);
    if (!takeDailySlot()) {
        throw new ServiceUnavailableError(
            'Untangle has done enough for today. Try again tomorrow.'
        );
    }

    const client = await ai.getOpenAIClient(null);
    const model = await ai.getAIModel(null);
    const userText = buildUserMessage(input);
    const content = input.image
        ? [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: input.image } },
          ]
        : userText;

    let response;
    try {
        response = await ai.callWithFallback(client, null, {
            model: input.image ? visionModel(model) : model,
            messages: [
                {
                    role: 'system',
                    content: `${SYSTEM_PROMPT}${languageInstruction(input.language)}`,
                },
                { role: 'user', content },
            ],
            max_tokens: ai.getMaxTokens('LLM_MAX_TOKENS_UNTANGLE', 8000),
            ...ai.getExtraBodyParams(),
            response_format: ai.buildResponseFormat('untangle', SCHEMA),
        });
    } catch (err) {
        // The provider's own message can name the model, the key or the
        // account; a stranger gets none of that.
        logError('Untangle provider call failed:', err);
        throw new AppError(
            'Untangle is having trouble right now. Try again in a moment.',
            502,
            'AI_UNAVAILABLE'
        );
    }

    const raw = ai.extractMessageContent(response.choices?.[0]?.message);
    let parsed = {};
    try {
        parsed = JSON.parse(ai.extractJSON(raw));
    } catch {
        parsed = {};
    }
    const result = sanitizeResult(parsed, input);
    return { result, token: signResult(result) };
}

// ---------------------------------------------------------------------------
// Signed tokens: the browser holds the result until Keep it, and the server
// only accepts back what it produced. Signed, not encrypted: the content is
// the person's own list, shown to them on the same screen.

function secret() {
    return getConfig().secret;
}

function signResult(result) {
    const payload = Buffer.from(
        JSON.stringify({ v: 1, iat: Date.now(), result })
    ).toString('base64url');
    const sig = crypto
        .createHmac('sha256', secret())
        .update(payload)
        .digest('base64url');
    return `${payload}.${sig}`;
}

function verifyToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) {
        throw new ValidationError('That plan is missing. Untangle it again.');
    }
    const [payload, sig] = token.split('.');
    const expected = crypto
        .createHmac('sha256', secret())
        .update(payload)
        .digest('base64url');
    const a = Buffer.from(sig || '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new ValidationError('That plan is not valid. Untangle it again.');
    }
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        throw new ValidationError('That plan is not valid. Untangle it again.');
    }
    const maxAge = (untangleConfig().tokenDays || 7) * 24 * 60 * 60 * 1000;
    if (
        !data ||
        data.v !== 1 ||
        !data.result ||
        Date.now() - data.iat > maxAge
    ) {
        throw new ValidationError('That plan has expired. Untangle it again.');
    }
    return data.result;
}

module.exports = {
    isUntangleEnabled,
    untangle,
    signResult,
    verifyToken,
    sanitizeResult,
    buildWeek,
    normalizeInput,
    resetDailyCounter,
    LIMITS,
    SYSTEM_PROMPT,
    SCHEMA,
};
