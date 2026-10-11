import type { FC } from 'react';
import type { PluginApi } from './host-api';
import { getReact } from './react';

interface TaskLike {
    uid?: string;
    name?: string;
    status?: number | string;
}

interface DailyPlanResponse {
    date?: string;
    plan?: unknown[];
}

const TASK_STATUS_DONE = 2;

const isDone = (task: TaskLike | null): boolean =>
    task?.status === TASK_STATUS_DONE ||
    task?.status === 'done' ||
    task?.status === 'completed';

/**
 * A plan entry nests a serialized task; tolerate either shape so a change in
 * the envelope does not blank the page.
 */
const toTask = (entry: unknown): TaskLike | null => {
    if (!entry || typeof entry !== 'object') return null;

    const record = entry as Record<string, unknown>;
    const candidate = (
        record.task && typeof record.task === 'object' ? record.task : record
    ) as Record<string, unknown>;

    const uid = typeof candidate.uid === 'string' ? candidate.uid : undefined;
    const name =
        typeof candidate.name === 'string' ? candidate.name : undefined;

    if (!uid && !name) return null;

    return {
        uid,
        name,
        status: candidate.status as number | string | undefined,
    };
};

const describeError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

/**
 * Today, reduced to a single item.
 *
 * The committed daily plan is the source: it is the list the person already
 * chose, which is what makes showing only the first entry honest rather than
 * arbitrary. There are deliberately no counts, no deadline colouring and no
 * overdue wording anywhere on this page — that is the entire point of it.
 */
export const createFocusPage =
    (api: PluginApi): FC =>
    () => {
        const React = getReact();
        const { useCallback, useEffect, useState } = React;

        const [tasks, setTasks] = useState<TaskLike[]>([]);
        const [offset, setOffset] = useState(0);
        const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(
            'loading'
        );
        const [message, setMessage] = useState<string | null>(null);
        const [capture, setCapture] = useState('');
        const [busy, setBusy] = useState(false);

        const load = useCallback(async () => {
            setPhase('loading');
            try {
                const plan = await api.api.get<DailyPlanResponse>('daily-plan');
                const planned = (plan?.plan || [])
                    .map(toTask)
                    .filter((task): task is TaskLike => task !== null)
                    .filter((task) => !isDone(task));

                setTasks(planned);
                setOffset(0);
                setMessage(null);
                setPhase('ready');
            } catch (error) {
                setPhase('error');
                setMessage(describeError(error));
            }
        }, []);

        useEffect(() => {
            load();
        }, [load]);

        const current = tasks[offset] || null;

        const complete = async () => {
            if (!current?.uid || busy) return;
            setBusy(true);
            try {
                await api.api.patch(`task/${current.uid}`, { status: 'done' });
                // Removing it locally is what makes the next item appear
                // instantly; a refetch would leave a delay after every tap.
                setTasks((previous) =>
                    previous.filter((task) => task.uid !== current.uid)
                );
                setOffset(0);
                setMessage(null);
            } catch (error) {
                setMessage(describeError(error));
            } finally {
                setBusy(false);
            }
        };

        const captureOne = async (event: { preventDefault(): void }) => {
            event.preventDefault();
            const name = capture.trim();
            if (!name || busy) return;

            setBusy(true);
            try {
                const created = await api.api.post<Record<string, unknown>>(
                    'task',
                    { name }
                );
                setCapture('');
                setMessage(null);
                const task = toTask(created);
                if (task) {
                    setTasks((previous) => [task, ...previous]);
                    setOffset(0);
                }
            } catch (error) {
                setMessage(describeError(error));
            } finally {
                setBusy(false);
            }
        };

        return (
            <div className="calm-focus-card">
                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    One thing at a time
                </h1>

                {phase === 'loading' && (
                    <p className="calm-focus-meta mt-6">Looking at today…</p>
                )}

                {phase === 'error' && (
                    <p className="calm-focus-meta mt-6">
                        Could not read today’s plan. {message}
                    </p>
                )}

                {phase === 'ready' && (
                    <>
                        <div className="mt-8">
                            {current ? (
                                <p className="calm-focus-task">
                                    {current.name || 'Untitled task'}
                                </p>
                            ) : (
                                <p className="calm-focus-task">
                                    Nothing planned. Add one thing.
                                </p>
                            )}
                        </div>

                        {current && (
                            <div className="calm-focus-actions">
                                <button
                                    type="button"
                                    className="calm-button calm-button-primary"
                                    onClick={complete}
                                    disabled={busy}
                                >
                                    Done
                                </button>
                                {tasks.length > 1 && (
                                    <button
                                        type="button"
                                        className="calm-button calm-button-quiet"
                                        onClick={() =>
                                            setOffset(
                                                (previous) =>
                                                    (previous + 1) %
                                                    tasks.length
                                            )
                                        }
                                        disabled={busy}
                                    >
                                        Show me another
                                    </button>
                                )}
                            </div>
                        )}

                        {tasks.length > 1 && (
                            <p className="calm-focus-meta mt-6">
                                More is planned for today when you want it.
                            </p>
                        )}
                    </>
                )}

                <form className="mt-10" onSubmit={captureOne}>
                    <label
                        className="calm-focus-meta"
                        htmlFor="calm-mode-capture"
                    >
                        Add one thing
                    </label>
                    <input
                        id="calm-mode-capture"
                        className="calm-field mt-2"
                        value={capture}
                        onChange={(event) => setCapture(event.target.value)}
                        placeholder="What needs doing?"
                        autoComplete="off"
                    />
                </form>

                {phase !== 'error' && message && (
                    <p className="calm-focus-meta mt-4">{message}</p>
                )}
            </div>
        );
    };
