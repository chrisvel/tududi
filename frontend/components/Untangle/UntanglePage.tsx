import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CameraIcon,
    MicrophoneIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    clearPendingUntangle,
    fetchUntangleStatus,
    keepUntangled,
    readPendingUntangle,
    stashPendingUntangle,
    untangle,
    untangleSample,
    KeepResult,
    UntangleAnswer,
    UntangleResult as Result,
    UntangleSample,
} from '../../utils/untangleService';
import UntangleResult from './UntangleResult';

// The public Untangle page: paste a messy list (or a screenshot of one),
// get it back as areas, goals, projects, tasks, waiting-fors, habits, tags
// and dates, with one thing for today, a few to drop, tips, and one round
// of questions. "Keep it" seeds the account; signed out, it parks the plan
// in this browser and sends the person to sign up.

interface UntanglePageProps {
    isSignedIn: boolean;
    onKept: (result: KeepResult) => void;
}

type Stage = 'checking' | 'unavailable' | 'input' | 'busy' | 'result';

const MAX_IMAGE_EDGE = 1600;
// Under test there is no one to watch the lines go by
const SAMPLE_MIN_BUSY_MS = process.env.NODE_ENV === 'test' ? 0 : 4500;

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

// The loading mark: a knotted line that keeps pulling itself straight.
// Plain SVG animation, so it needs no stylesheet; the busy screen is the
// only place it shows.
const TANGLED =
    'M8 20 C 20 -6, 30 46, 44 20 C 58 -6, 66 46, 80 20 C 94 -6, 104 46, 116 20';
const STRAIGHT =
    'M8 20 C 20 20, 30 20, 44 20 C 58 20, 66 20, 80 20 C 94 20, 104 20, 116 20';

const UntanglingLine: React.FC = () => (
    <svg
        viewBox="0 0 124 40"
        className="h-10 w-32 text-brand dark:text-brand-300"
        aria-hidden="true"
    >
        <path
            d={TANGLED}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
        >
            <animate
                attributeName="d"
                values={`${TANGLED};${STRAIGHT};${STRAIGHT};${TANGLED}`}
                keyTimes="0;0.55;0.7;1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1"
                dur="2.4s"
                repeatCount="indefinite"
            />
        </path>
    </svg>
);

const Wordmark: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
    <header className="mb-10 text-center" data-testid="untangle-logo">
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-baseline justify-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            aria-label="untangled.my"
        >
            <span className="font-wordmark text-[13.5vw] font-black leading-none tracking-[-0.045em] sm:text-7xl md:text-8xl">
                untangled
            </span>
            <span className="font-hand ml-1 inline-block -rotate-3 text-[15vw] font-semibold leading-none text-brand sm:text-7xl md:text-[6.25rem] dark:text-brand-300">
                .my
            </span>
        </button>
    </header>
);

const UntanglePage: React.FC<UntanglePageProps> = ({ isSignedIn, onKept }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const [stage, setStage] = useState<Stage>('checking');
    const [text, setText] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [answers, setAnswers] = useState<UntangleAnswer[]>([]);
    const [picked, setPicked] = useState<Record<string, string>>({});
    const [seconds, setSeconds] = useState(0);
    const [keeping, setKeeping] = useState(false);
    const [samples, setSamples] = useState<UntangleSample[]>([]);
    // The sample the box holds, or null when the text is the person's own
    const [sampleKey, setSampleKey] = useState<string | null>(null);
    const [resultIsSample, setResultIsSample] = useState(false);
    const [pendingStart, setPendingStart] = useState(false);

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const speechSupported = !!speechRecognitionClass();

    useEffect(() => {
        let active = true;
        fetchUntangleStatus().then((status) => {
            if (!active) return;
            setSamples(status.samples);
            if (!status.available) {
                setStage('unavailable');
                return;
            }
            // A list parked before sign-up: it runs now, as the free one
            const pending = isSignedIn ? readPendingUntangle() : null;
            if (pending) {
                clearPendingUntangle();
                setText(pending.text);
                setImage(pending.image);
                setSampleKey(null);
                setPendingStart(true);
            }
            setStage('input');
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!pendingStart || stage !== 'input') return;
        setPendingStart(false);
        void run([]);
    }, [pendingStart, stage]);

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

    const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = () => (i18n.language || 'en').slice(0, 2);

    // Samples run for anyone. A person's own list needs an account: signed
    // out, the list waits in this browser and sign-up takes over.
    const run = async (nextAnswers: UntangleAnswer[]) => {
        if (!sampleKey && !isSignedIn) {
            stashPendingUntangle({
                text,
                image,
                timezone: timezone(),
                language: language(),
            });
            navigate('/register', { state: { untangle: true } });
            return;
        }
        setError(null);
        setStage('busy');
        try {
            const common = {
                timezone: timezone(),
                language: language(),
                answers: nextAnswers,
            };
            // A cached sample answers in milliseconds, which reads as fake;
            // hold the working screen for a few seconds so the person sees
            // the lines go by and the result land.
            const started = Date.now();
            const res = sampleKey
                ? await untangleSample({ key: sampleKey, ...common })
                : await untangle({ text, image, ...common });
            if (sampleKey) {
                const left = SAMPLE_MIN_BUSY_MS - (Date.now() - started);
                if (left > 0) {
                    await new Promise((r) => window.setTimeout(r, left));
                }
            }
            setResult(res.result);
            setToken(res.token);
            setResultIsSample(!!sampleKey);
            setAnswers(nextAnswers);
            setPicked({});
            setStage('result');
            window.scrollTo({ top: 0 });
        } catch (err) {
            const code = (err as { code?: string })?.code;
            setError(
                code === 'PLAN_LIMIT_REACHED'
                    ? t(
                          'untangle.errors.used',
                          'You have used your free untangle. AI credits on a paid plan cover more.'
                      )
                    : err instanceof Error
                      ? err.message
                      : t('untangle.errors.generic', 'Could not untangle that.')
            );
            setStage(result ? 'result' : 'input');
        }
    };

    const loadSample = (sample: UntangleSample) => {
        setText(sample.text);
        setImage(null);
        setError(null);
        setSampleKey(sample.key);
    };

    // One round of questions: pick an option for each, then re-plan once.
    const questions = result?.questions || [];
    const allAnswered =
        questions.length > 0 && questions.every((q) => picked[q.text]);
    const answerAll = () => {
        if (!allAnswered) return;
        void run([
            ...answers,
            ...questions.map((q) => ({
                question: q.text,
                answer: picked[q.text],
            })),
        ]);
    };

    const keep = async () => {
        if (!token || keeping) return;
        if (!isSignedIn) {
            navigate('/register');
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

    const startOver = (ownList = false) => {
        setResult(null);
        setToken(null);
        setAnswers([]);
        setPicked({});
        setError(null);
        if (ownList) {
            setText('');
            setImage(null);
            setSampleKey(null);
        }
        setStage('input');
    };

    const canRun = text.trim().length > 0 || !!image;

    return (
        <div
            className="min-h-screen bg-paper font-ui text-ink antialiased dark:bg-gray-900 dark:text-gray-100"
            data-testid="untangle-page"
        >
            <main
                className={`px-4 pb-28 sm:px-6 lg:px-8 ${
                    stage === 'result'
                        ? 'pt-10'
                        : 'flex min-h-screen items-center justify-center py-10'
                }`}
            >
                <div
                    className={`mx-auto w-full ${
                        stage === 'result' ? 'max-w-5xl' : 'max-w-2xl'
                    }`}
                >
                    <Wordmark
                        onClick={() => {
                            if (stage === 'result') startOver(resultIsSample);
                            else window.scrollTo({ top: 0 });
                        }}
                    />

                    {stage === 'checking' && (
                        <p className="text-center text-gray-500 dark:text-gray-400">
                            {t('untangle.loading', 'One moment...')}
                        </p>
                    )}

                    {stage === 'unavailable' && (
                        <div className="text-center">
                            <h1 className="mb-2 font-display text-3xl font-medium">
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
                            <h1 className="font-display text-4xl font-medium leading-tight tracking-tight [text-wrap:balance] sm:text-5xl">
                                {t('untangle.title', 'Paste your mess.')}
                            </h1>
                            <p className="mt-3 max-w-prose text-lg leading-relaxed text-gray-600 dark:text-gray-400">
                                {t(
                                    'untangle.lede',
                                    'Try a sample and watch it turn into a plan. Then paste your own: a free tududi account untangles it for you.'
                                )}
                            </p>

                            <div className="mt-5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                                    {t(
                                        'untangle.samples.kicker',
                                        'No list handy? Try one of these'
                                    )}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {samples.map((sample) => (
                                        <button
                                            key={sample.key}
                                            type="button"
                                            onClick={() => loadSample(sample)}
                                            className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-brand-50 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                            data-testid={`untangle-sample-${sample.key}`}
                                        >
                                            {t(
                                                `untangle.samples.${sample.key}`,
                                                sample.label
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-gray-800">
                                <textarea
                                    id="untangle-text"
                                    value={text}
                                    onChange={(e) => {
                                        setText(e.target.value);
                                        setSampleKey(null);
                                    }}
                                    onPaste={handlePaste}
                                    rows={10}
                                    placeholder={t(
                                        'untangle.placeholder',
                                        'call landlord re deposit!!\ncrete??\ndentist\ngym x3\nmum bday 24th\nask Maria about the contract'
                                    )}
                                    className="w-full resize-y rounded-xl bg-paper px-4 py-3 text-lg leading-relaxed text-ink placeholder:text-gray-400/80 focus:outline-none focus:ring-2 focus:ring-brand/50 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                    data-testid="untangle-textarea"
                                />
                                {image && (
                                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-900/30">
                                        <img
                                            src={image}
                                            alt=""
                                            className="h-12 w-12 rounded-lg object-cover"
                                        />
                                        <span className="flex-1 text-sm text-brand-700 dark:text-brand-200">
                                            {t(
                                                'untangle.screenshotAttached',
                                                'Screenshot attached'
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setImage(null)}
                                            className="p-1 text-brand-700 hover:text-brand-900 dark:text-brand-200"
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
                                        className="inline-flex items-center gap-2 rounded-lg bg-paper-deep px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
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
                                                    : 'bg-paper-deep text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
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
                                className="mt-5 h-12 w-full rounded-xl bg-brand text-base font-semibold text-white shadow-sm hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid="untangle-run"
                            >
                                {sampleKey || isSignedIn
                                    ? t('untangle.run', 'Untangle it')
                                    : t(
                                          'untangle.runSignUp',
                                          'Untangle it, free with an account'
                                      )}
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
                            className="flex flex-col items-center justify-center py-10 text-center"
                            data-testid="untangle-busy"
                        >
                            <UntanglingLine />
                            <p className="mt-4 font-display text-xl">
                                {
                                    busyLines[
                                        Math.floor(seconds / 3) %
                                            busyLines.length
                                    ]
                                }
                            </p>
                            <p className="mt-1 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                                {seconds}s
                            </p>
                        </section>
                    )}

                    {stage === 'result' && result && (
                        <>
                            <UntangleResult
                                result={result}
                                picked={picked}
                                onPick={(question, option) =>
                                    setPicked((prev) => ({
                                        ...prev,
                                        [question]: option,
                                    }))
                                }
                                onAnswerAll={answerAll}
                                allAnswered={allAnswered}
                            />

                            {error && (
                                <p
                                    className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-4 pt-6 dark:from-gray-900 dark:via-gray-900">
                                <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            startOver(resultIsSample)
                                        }
                                        className="h-12 rounded-xl bg-white px-4 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                        data-testid="untangle-start-over"
                                    >
                                        {resultIsSample
                                            ? t(
                                                  'untangle.tryOwn',
                                                  'Try your own list'
                                              )
                                            : t(
                                                  'untangle.startOver',
                                                  'Start over'
                                              )}
                                    </button>
                                    {resultIsSample && !isSignedIn ? (
                                        <button
                                            type="button"
                                            onClick={() => startOver(true)}
                                            className="h-12 flex-1 rounded-xl bg-brand text-base font-semibold text-white shadow-sm hover:bg-brand-600 md:max-w-xs"
                                            data-testid="untangle-own"
                                        >
                                            {t(
                                                'untangle.ownCta',
                                                'Untangle my own list'
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={keep}
                                            disabled={keeping}
                                            className="h-12 flex-1 rounded-xl bg-brand text-base font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 md:max-w-xs"
                                            data-testid="untangle-keep"
                                        >
                                            {keeping
                                                ? t(
                                                      'untangle.keeping',
                                                      'Keeping...'
                                                  )
                                                : t('untangle.keep', 'Keep it')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UntanglePage;
