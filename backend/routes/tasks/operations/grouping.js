const moment = require('moment-timezone');
const { getSafeTimezone } = require('../../../utils/timezone-utils');
const { sortTasksByOrder } = require('./sorting');

function categorizeTasksByDate(tasks, cutoffDate, safeTimezone) {
    const tasksByDate = new Map();

    tasks.forEach((task) => {
        if (!task.due_date) {
            if (!tasksByDate.has('no-date')) {
                tasksByDate.set('no-date', []);
            }
            tasksByDate.get('no-date').push(task);
            return;
        }

        const taskDueDate = moment.tz(task.due_date, safeTimezone);

        if (taskDueDate.isAfter(cutoffDate)) {
            return;
        }

        const dateKey = taskDueDate.format('YYYY-MM-DD');

        if (!tasksByDate.has(dateKey)) {
            tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey).push(task);
    });

    return tasksByDate;
}

function generateGroupName(dateKey, now, safeTimezone, language = 'en') {
    // Map language codes to moment.js locale codes
    const localeMap = {
        en: 'en',
        ar: 'ar',
        bg: 'bg',
        da: 'da',
        de: 'de',
        el: 'el',
        es: 'es',
        fi: 'fi',
        fr: 'fr',
        id: 'id',
        it: 'it',
        jp: 'ja',
        ko: 'ko',
        nl: 'nl',
        no: 'nb',
        pl: 'pl',
        pt: 'pt',
        ro: 'ro',
        ru: 'ru',
        sl: 'sl',
        sv: 'sv',
        tr: 'tr',
        ua: 'uk',
        vi: 'vi',
        zh: 'zh-cn',
    };

    const momentLocale = localeMap[language] || 'en';
    const dateMoment = moment.tz(dateKey, safeTimezone).locale(momentLocale);
    const dayName = dateMoment.format('dddd');
    const dateDisplay = dateMoment.format('MMMM D');
    const isToday = dateMoment.isSame(now, 'day');
    const isTomorrow = dateMoment.isSame(now.clone().add(1, 'day'), 'day');

    // Translation map for "Today", "Tomorrow", and "No Due Date"
    const translations = {
        today: {
            en: 'Today',
            ar: 'اليوم',
            bg: 'Днес',
            da: 'I dag',
            de: 'Heute',
            el: 'Σήμερα',
            es: 'Hoy',
            fi: 'Tänään',
            fr: "Aujourd'hui",
            id: 'Hari ini',
            it: 'Oggi',
            jp: '今日',
            ko: '오늘',
            nl: 'Vandaag',
            no: 'I dag',
            pl: 'Dzisiaj',
            pt: 'Hoje',
            ro: 'Astăzi',
            ru: 'Сегодня',
            sl: 'Danes',
            sv: 'Idag',
            tr: 'Bugün',
            ua: 'Сьогодні',
            vi: 'Hôm nay',
            zh: '今天',
        },
        tomorrow: {
            en: 'Tomorrow',
            ar: 'غداً',
            bg: 'Утре',
            da: 'I morgen',
            de: 'Morgen',
            el: 'Αύριο',
            es: 'Mañana',
            fi: 'Huomenna',
            fr: 'Demain',
            id: 'Besok',
            it: 'Domani',
            jp: '明日',
            ko: '내일',
            nl: 'Morgen',
            no: 'I morgen',
            pl: 'Jutro',
            pt: 'Amanhã',
            ro: 'Mâine',
            ru: 'Завтра',
            sl: 'Jutri',
            sv: 'Imorgon',
            tr: 'Yarın',
            ua: 'Завтра',
            vi: 'Ngày mai',
            zh: '明天',
        },
        noDueDate: {
            en: 'No Due Date',
            ar: 'لا يوجد تاريخ استحقاق',
            bg: 'Няма краен срок',
            da: 'Ingen frist',
            de: 'Kein Fälligkeitsdatum',
            el: 'Χωρίς προθεσμία',
            es: 'Sin fecha de vencimiento',
            fi: 'Ei määräaikaa',
            fr: "Pas de date d'échéance",
            id: 'Tidak ada tanggal jatuh tempo',
            it: 'Nessuna scadenza',
            jp: '期限なし',
            ko: '마감일 없음',
            nl: 'Geen deadline',
            no: 'Ingen frist',
            pl: 'Brak terminu',
            pt: 'Sem prazo',
            ro: 'Fără termen limită',
            ru: 'Нет срока',
            sl: 'Ni roka',
            sv: 'Ingen deadline',
            tr: 'Son tarih yok',
            ua: 'Немає терміну',
            vi: 'Không có hạn',
            zh: '无截止日期',
        },
    };

    if (isToday) {
        return translations.today[language] || translations.today.en;
    } else if (isTomorrow) {
        return translations.tomorrow[language] || translations.tomorrow.en;
    } else {
        return `${dayName}, ${dateDisplay}`;
    }
}

async function groupTasksByDay(
    tasks,
    userTimezone,
    maxDays = 14,
    orderBy = 'created_at:desc',
    language = 'en'
) {
    const safeTimezone = getSafeTimezone(userTimezone);
    const now = moment.tz(safeTimezone);
    const cutoffDate = now.clone().add(maxDays, 'days').endOf('day');

    const tasksByDate = categorizeTasksByDate(tasks, cutoffDate, safeTimezone);

    const sortedDates = Array.from(tasksByDate.keys())
        .filter((key) => key !== 'no-date' && key !== 'later')
        .sort();

    const groupedTasks = {};

    sortedDates.forEach((dateKey) => {
        const groupName = generateGroupName(
            dateKey,
            now,
            safeTimezone,
            language
        );
        const tasksForDate = tasksByDate.get(dateKey);
        sortTasksByOrder(tasksForDate, orderBy, safeTimezone);
        groupedTasks[groupName] = tasksForDate;
    });

    if (tasksByDate.has('no-date')) {
        const noDateTasks = tasksByDate.get('no-date');
        sortTasksByOrder(noDateTasks, orderBy, safeTimezone);
        // Use translated "No Due Date"
        const translations = {
            noDueDate: {
                en: 'No Due Date',
                ar: 'لا يوجد تاريخ استحقاق',
                bg: 'Няма краен срок',
                da: 'Ingen frist',
                de: 'Kein Fälligkeitsdatum',
                el: 'Χωρίς προθεσμία',
                es: 'Sin fecha de vencimiento',
                fi: 'Ei määräaikaa',
                fr: "Pas de date d'échéance",
                id: 'Tidak ada tanggal jatuh tempo',
                it: 'Nessuna scadenza',
                jp: '期限なし',
                ko: '마감일 없음',
                nl: 'Geen deadline',
                no: 'Ingen frist',
                pl: 'Brak terminu',
                pt: 'Sem prazo',
                ro: 'Fără termen limită',
                ru: 'Нет срока',
                sl: 'Ni roka',
                sv: 'Ingen deadline',
                tr: 'Son tarih yok',
                ua: 'Немає терміну',
                vi: 'Không có hạn',
                zh: '无截止日期',
            },
        };
        const noDueDateLabel =
            translations.noDueDate[language] || translations.noDueDate.en;
        groupedTasks[noDueDateLabel] = noDateTasks;
    }

    return groupedTasks;
}

module.exports = {
    categorizeTasksByDate,
    generateGroupName,
    groupTasksByDay,
};
