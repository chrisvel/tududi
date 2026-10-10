import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowPathIcon,
    CameraIcon,
    MicrophoneIcon,
    MoonIcon,
    SunIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { getAssetPath } from '../../config/paths';
import {
    isUntangleAvailable,
    keepUntangled,
    stashPendingUntangle,
    untangle,
    KeepResult,
    UntangleAnswer,
    UntangleArea,
    UntangleItem,
    UntangleResult,
} from '../../utils/untangleService';

// The public Untangle page: paste a messy list (or a screenshot of one),
// get it back as areas, projects, tasks, waiting-fors and habits, with one
// thing for today, a few to drop, the week's load and at most one question.
// "Keep it" seeds the account; signed out, it parks the plan in this
// browser and sends the person to sign up.

interface UntanglePageProps {
    isSignedIn: boolean;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    onKept: (result: KeepResult) => void;
}

type Stage = 'checking' | 'unavailable' | 'input' | 'busy' | 'result';

const MAX_IMAGE_EDGE = 1600;

// Phone screenshots are big; the model reads them fine at 1600px, and the
// request stays small. Always a JPEG afterwards.
async function fileToDataUrl(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
        1,
        MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height)
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read the image');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
}

interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: any) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
}

function speechRecognitionClass(): (new () => SpeechRecognitionLike) | null {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const kindTint: Record<UntangleItem['kind'], string> = {
    task: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    waiting: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    habit: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    someday: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const UntanglePage: React.FC<UntanglePageProps> = ({
    isSignedIn,
    isDarkMode,
    toggleDarkMode,
    onKept,
}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const [stage, setStage] = useState<Stage>('checking');
    const [text, setText] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<UntangleResult | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [answers, setAnswers] = useState<UntangleAnswer[]>([]);
    const [seconds, setSeconds] = useState(0);
    const [keeping, setKeeping] = useState(false);

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const speechSupported = !!speechRecognitionClass();

    useEffect(() => {
        let active = true;
        isUntangleAvailable().then((ok) => {
            if (active) setStage(ok ? 'input' : 'unavailable');
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (stage !== 'busy') return undefined;
        setSeconds(0);
        const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => window.clearInterval(timer);
    }, [stage]);

    useEffect(
        () => () => {
            recognitionRef.current?.stop();
        },
        []
    );

    const busyLines = [
        t('untangle.busy.reading', 'Reading every line'),
        t('untangle.busy.sorting', 'Sorting it into areas'),
        t('untangle.busy.people', 'Spotting people and habits'),
        t('untangle.busy.dates', 'Working out the dates'),
        t('untangle.busy.today', 'Picking one thing for today'),
    ];

    const addImageFile = useCallback(
        async (file: File) => {
            if (!file.type.startsWith('image/')) return;
            try {
                setImage(await fileToDataUrl(file));
                setError(null);
            } catch {
                setError(
                    t('untangle.errors.image', 'Could not read that image.')
                );
            }
        },
        [t]
    );

    const handlePaste = (event: React.ClipboardEvent) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((it) => it.type.startsWith('image/'));
        if (imageItem) {
            const file = imageItem.getAsFile();
            if (file) {
                event.preventDefault();
                void addImageFile(file);
            }
        }
    };

    const toggleListening = () => {
        const Recognition = speechRecognitionClass();
        if (!Recognition) return;
        if (listening) {
            recognitionRef.current?.stop();
            return;
        }
        const recognition = new Recognition();
        recognition.lang = i18n.language || 'en';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event: any) => {
            let spoken = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                if (event.results[i].isFinal) {
                    spoken += `${event.results[i][0].transcript.trim()}\n`;
                }
            }
            if (spoken) {
                setText((prev) =>
                    prev && !prev.endsWith('\n')
                        ? `${prev}\n${spoken}`
                        : prev + spoken
                );
            }
        };
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    };

    const run = async (nextAnswers: UntangleAnswer[]) => {
        setError(null);
        setStage('busy');
        try {
            const res = await untangle({
                text,
                image,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: (i18n.language || 'en').slice(0, 2),
                answers: nextAnswers,
            });
            setResult(res.result);
            setToken(res.token);
            setAnswers(nextAnswers);
            setStage('result');
            window.scrollTo({ top: 0 });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('untangle.errors.generic', 'Could not untangle that.')
            );
            setStage(result ? 'result' : 'input');
        }
    };

    const answer = (option: string) => {
        if (!result?.question) return;
        void run([
            ...answers,
            { question: result.question.text, answer: option },
        ]);
    };

    const keep = async () => {
        if (!token || keeping) return;
        if (!isSignedIn) {
            stashPendingUntangle(token);
            navigate('/register', { state: { untangle: true } });
            return;
        }
        setKeeping(true);
        setError(null);
        try {
            onKept(await keepUntangled(token));
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('untangle.errors.keep', 'Could not keep the plan.')
            );
            setKeeping(false);
        }
    };

    const startOver = () => {
        setResult(null);
        setToken(null);
        setAnswers([]);
        setError(null);
        setStage('input');
    };

    const canRun = text.trim().length > 0 || !!image;
    const maxMinutes = Math.max(
        60,
        ...(result?.week.map((d) => d.minutes) || [0])
    );

    return (
        <div
            className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            data-testid="untangle-page"
        >
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-sm">
                <div className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link to={isSignedIn ? '/today' : '/login'}>
                        <img
                            src={getAssetPath(
                                isDarkMode
                                    ? 'wide-logo-light.png'
                                    : 'wide-logo-dark.png'
                            )}
                            alt="tududi"
                            className="h-9 w-auto"
                        />
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={toggleDarkMode}
                            className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white focus:outline-none"
                            aria-label={t(
                                'publicNote.toggleTheme',
                                'Toggle dark mode'
                            )}
                        >
                            {isDarkMode ? (
                                <SunIcon className="h-5 w-5" />
                            ) : (
                                <MoonIcon className="h-5 w-5" />
                            )}
                        </button>
                        {isSignedIn ? (
                            <Link
                                to="/today"
                                className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                            >
                                {t('publicNote.openApp', 'Open tududi')}
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {t('auth.signin', 'Sign In')}
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-2xl">
                    {stage === 'checking' && (
                        <p className="text-center text-gray-500 dark:text-gray-400">
                            {t('untangle.loading', 'One moment...')}
                        </p>
                    )}

                    {stage === 'unavailable' && (
                        <div className="text-center">
                            <h1 className="text-2xl font-light mb-2">
                                {t(
                                    'untangle.unavailableTitle',
                                    'Untangle is not available here'
                                )}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {t(
                                    'untangle.unavailableBody',
                                    'This instance has it switched off.'
                                )}
                            </p>
                        </div>
                    )}

                    {stage === 'input' && (
                        <section data-testid="untangle-input">
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {t('untangle.kicker', 'Untangle')}
                            </p>
                            <h1 className="mt-1 text-3xl font-light sm:text-4xl">
                                {t('untangle.title', 'Paste your mess.')}
                            </h1>
                            <p className="mt-3 text-gray-600 dark:text-gray-400">
                                {t(
                                    'untangle.lede',
                                    'A Notes list, a screenshot, whatever you have been carrying around. Ten seconds later it is a plan.'
                                )}
                            </p>

                            <div className="mt-6 rounded-2xl bg-white p-3 shadow-sm dark:bg-gray-800">
                                <textarea
                                    id="untangle-text"
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    onPaste={handlePaste}
                                    rows={8}
                                    placeholder={t(
                                        'untangle.placeholder',
                                        'call landlord re deposit!!\ncrete??\ndentist\ngym x3\nmum bday 24th\nask Maria about the contract'
                                    )}
                                    className="w-full resize-y rounded-xl bg-gray-50 px-4 py-3 text-base leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                    data-testid="untangle-textarea"
                                />
                                {image && (
                                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
                                        <img
                                            src={image}
                                            alt=""
                                            className="h-12 w-12 rounded-lg object-cover"
                                        />
                                        <span className="flex-1 text-sm text-blue-800 dark:text-blue-200">
                                            {t(
                                                'untangle.screenshotAttached',
                                                'Screenshot attached'
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setImage(null)}
                                            className="p-1 text-blue-700 hover:text-blue-900 dark:text-blue-200"
                                            aria-label={t(
                                                'untangle.removeScreenshot',
                                                'Remove screenshot'
                                            )}
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                )}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                        data-testid="untangle-screenshot"
                                    >
                                        <CameraIcon className="h-5 w-5" />
                                        {t(
                                            'untangle.addScreenshot',
                                            'Screenshot'
                                        )}
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        id="untangle-file"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) void addImageFile(file);
                                            e.target.value = '';
                                        }}
                                    />
                                    {speechSupported && (
                                        <button
                                            type="button"
                                            onClick={toggleListening}
                                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                                listening
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                            data-testid="untangle-mic"
                                        >
                                            <MicrophoneIcon className="h-5 w-5" />
                                            {listening
                                                ? t(
                                                      'untangle.listening',
                                                      'Listening, tap to stop'
                                                  )
                                                : t('untangle.talk', 'Talk')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <p
                                    className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={() => run([])}
                                disabled={!canRun}
                                className="mt-5 h-12 w-full rounded-xl bg-blue-600 text-base font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                                data-testid="untangle-run"
                            >
                                {t('untangle.run', 'Untangle it')}
                            </button>
                            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'untangle.privacy',
                                    'Nothing is stored until you choose to keep it.'
                                )}
                            </p>
                        </section>
                    )}

                    {stage === 'busy' && (
                        <section
                            className="flex min-h-[50vh] flex-col items-center justify-center text-center"
                            data-testid="untangle-busy"
                        >
                            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="mt-4 text-lg">
                                {
                                    busyLines[
                                        Math.floor(seconds / 3) %
                                            busyLines.length
                                    ]
                                }
                            </p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {seconds}s
                            </p>
                        </section>
                    )}

                    {stage === 'result' && result && (
                        <section
                            className="flex flex-col gap-4"
                            data-testid="untangle-result"
                        >
                            {result.today.title && (
                                <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-sm dark:bg-blue-500">
                                    <p className="text-xs font-medium uppercase tracking-wider text-blue-100">
                                        {t('untangle.today', 'Today')}
                                    </p>
                                    <p className="mt-1 text-xl font-medium">
                                        {result.today.title}
                                    </p>
                                    {result.today.reason && (
                                        <p className="mt-1 text-sm text-blue-100">
                                            {result.today.reason}
                                        </p>
                                    )}
                                </div>
                            )}

                            {result.drop.length > 0 && (
                                <div className="rounded-2xl bg-amber-50 px-5 py-4 dark:bg-amber-900/20">
                                    <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                        {t('untangle.drop', 'Drop for now')}
                                    </p>
                                    <ul className="mt-2 flex flex-col gap-1">
                                        {result.drop.map((d) => (
                                            <li
                                                key={d.title}
                                                className="text-sm text-amber-900 dark:text-amber-100"
                                            >
                                                <span className="font-medium">
                                                    {d.title}
                                                </span>
                                                {d.reason && (
                                                    <span className="text-amber-700 dark:text-amber-300">
                                                        {' '}
                                                        {d.reason}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {result.question && (
                                <div
                                    className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800"
                                    data-testid="untangle-question"
                                >
                                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        {t(
                                            'untangle.oneQuestion',
                                            'One question'
                                        )}
                                    </p>
                                    <p className="mt-1 text-base font-medium">
                                        {result.question.text}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {result.question.options.map((o) => (
                                            <button
                                                key={o}
                                                type="button"
                                                onClick={() => answer(o)}
                                                className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
                                            >
                                                {o}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {result.areas.map((area) => (
                                <AreaCard key={area.name} area={area} />
                            ))}

                            <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
                                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    {t('untangle.week', 'Your week')}
                                </p>
                                <div className="mt-3 grid grid-cols-7 gap-2">
                                    {result.week.map((day) => (
                                        <div
                                            key={day.date}
                                            className="flex flex-col items-center gap-1"
                                            title={day.titles.join(', ')}
                                        >
                                            <div className="flex h-20 w-full items-end">
                                                <div
                                                    className="w-full rounded-md bg-blue-500/80 dark:bg-blue-400/80"
                                                    style={{
                                                        height: `${Math.max(
                                                            4,
                                                            (day.minutes /
                                                                maxMinutes) *
                                                                100
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {day.weekday}
                                            </span>
                                            <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                                                {day.minutes > 0
                                                    ? `${Math.round(day.minutes / 60)}h`
                                                    : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <p
                                    className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-gray-100 via-gray-100 to-transparent px-4 pb-4 pt-6 dark:from-gray-900 dark:via-gray-900">
                                <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={startOver}
                                        className="h-12 rounded-xl bg-white px-4 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        {t('untangle.startOver', 'Start over')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={keep}
                                        disabled={keeping}
                                        className="h-12 flex-1 rounded-xl bg-blue-600 text-base font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                                        data-testid="untangle-keep"
                                    >
                                        {keeping
                                            ? t(
                                                  'untangle.keeping',
                                                  'Keeping...'
                                              )
                                            : t('untangle.keep', 'Keep it')}
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
};

const AreaCard: React.FC<{ area: UntangleArea }> = ({ area }) => {
    const { t } = useTranslation();
    const kindLabel = (item: UntangleItem) => {
        switch (item.kind) {
            case 'waiting':
                return item.person
                    ? t('untangle.kind.waitingFor', 'waiting for {{name}}', {
                          name: item.person,
                      })
                    : t('untangle.kind.waiting', 'waiting');
            case 'habit':
                return t('untangle.kind.habit', 'habit, {{n}}x {{period}}', {
                    n: item.habit_times || 1,
                    period: item.habit_period || 'weekly',
                });
            case 'someday':
                return t('untangle.kind.someday', 'someday');
            default:
                return null;
        }
    };

    const dueLabel = (due: string | null) => {
        if (!due) return '';
        const date = new Date(`${due}T00:00:00`);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div
            className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800"
            data-testid="untangle-area"
        >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {area.name}
            </p>
            {area.goal && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                        {t('untangle.goal', 'Goal')}: {area.goal.title}
                    </span>
                    {area.goal.why && (
                        <span className="text-gray-500 dark:text-gray-400">
                            {' '}
                            {area.goal.why}
                        </span>
                    )}
                </p>
            )}
            <ul className="mt-3 flex flex-col gap-2">
                {area.projects.map((project) => (
                    <li
                        key={project.name}
                        className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{project.name}</span>
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                                {t('untangle.project', 'project')}
                            </span>
                        </div>
                        <ul className="mt-2 flex flex-col gap-1">
                            {project.tasks.map((task) => (
                                <li
                                    key={task.title}
                                    className="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    <span className="min-w-0 truncate">
                                        {task.title}
                                    </span>
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {dueLabel(task.due)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
                {area.items.map((item) => (
                    <li
                        key={`${item.kind}-${item.title}`}
                        className="flex items-center justify-between gap-2 px-1 text-sm"
                    >
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                                className={
                                    item.kind === 'someday'
                                        ? 'text-gray-500 dark:text-gray-400'
                                        : ''
                                }
                            >
                                {item.title}
                            </span>
                            {kindLabel(item) && (
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] ${kindTint[item.kind]}`}
                                >
                                    {kindLabel(item)}
                                </span>
                            )}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                            {dueLabel(item.due)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default UntanglePage;
