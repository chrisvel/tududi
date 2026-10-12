// T-802/803: an explicit manifest and fresh consent for each invocation.
import React, { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
    aiTargets,
    features,
    Feature,
    AiRequest,
    Manifest,
    AiResult,
    previewAi,
    runAi,
    saveAiReview,
} from '../../utils/ltdAiService';
import { refreshPlanning } from '../../utils/planningService';
const defaults: AiRequest = {
    feature: 'tomorrow',
    period: 'day',
    allow_notes: false,
    allow_calendar_titles: false,
    token_budget: 8000,
};
export default function PlanningAssistant({
    onChanged,
}: {
    onChanged: () => Promise<unknown>;
}) {
    const { t } = useTranslation();
    const { data: targets } = useSWR('ltd:ai-targets', aiTargets);
    const [form, setForm] = useState<AiRequest>(defaults);
    const [preview, setPreview] = useState<Manifest | null>(null);
    const [result, setResult] = useState<AiResult | null>(null);
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const change = (patch: Partial<AiRequest>) => {
        setForm((f) => ({ ...f, ...patch }));
        setPreview(null);
        setConsent(false);
        setResult(null);
        setSaved(false);
    };
    const act = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await fn();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <section
            className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            aria-label={t('ltdAi.title')}
        >
            <h2 className="font-semibold">{t('ltdAi.title')}</h2>
            <p className="text-sm text-gray-500">{t('ltdAi.intro')}</p>
            <label className="block">
                {t('ltdAi.feature')}
                <select
                    className="ms-2 rounded border bg-transparent p-2"
                    value={form.feature}
                    disabled={busy}
                    onChange={(e) =>
                        change({ feature: e.target.value as Feature })
                    }
                >
                    {features.map((f) => (
                        <option key={f} value={f}>
                            {t(`ltdAi.features.${f}`)}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block">
                {t('ltdAi.date')}
                <input
                    type="date"
                    className="ms-2 rounded border bg-transparent p-2"
                    value={form.date || ''}
                    disabled={busy}
                    onChange={(e) =>
                        change({ date: e.target.value || undefined })
                    }
                />
            </label>
            {['why', 'decompose'].includes(form.feature) && (
                <div className="space-y-2">
                    {form.feature === 'decompose' && (
                        <label>
                            {t('ltdAi.targetType')}
                            <select
                                className="ms-2 rounded border bg-transparent p-2"
                                disabled={busy}
                                value={form.target_type || 'task'}
                                onChange={(e) =>
                                    change({
                                        target_type: e.target.value as
                                            'goal' | 'task',
                                    })
                                }
                            >
                                <option value="task">{t('ltdAi.task')}</option>
                                <option value="goal">{t('ltdAi.goal')}</option>
                            </select>
                        </label>
                    )}
                    <fieldset className="max-h-48 overflow-auto space-y-2">
                        <legend>{t('ltdAi.target')}</legend>
                        {(form.feature === 'decompose' &&
                        form.target_type === 'goal'
                            ? targets?.goals
                            : targets?.tasks
                        )?.map((item) => (
                            <label key={item.uid} className="block">
                                <input
                                    type="radio"
                                    name="ai-target"
                                    disabled={busy}
                                    checked={form.target_uid === item.uid}
                                    onChange={() =>
                                        change({ target_uid: item.uid })
                                    }
                                />{' '}
                                <bdi>{item.title}</bdi>
                            </label>
                        ))}
                    </fieldset>
                </div>
            )}
            {form.feature === 'review' && (
                <label>
                    {t('ltdAi.period')}
                    <select
                        className="ms-2 rounded border bg-transparent p-2"
                        disabled={busy}
                        value={form.period}
                        onChange={(e) =>
                            change({ period: e.target.value as 'day' | 'week' })
                        }
                    >
                        <option value="day">{t('ltdAi.day')}</option>
                        <option value="week">{t('ltdAi.week')}</option>
                    </select>
                </label>
            )}
            <label className="block">
                <input
                    type="checkbox"
                    checked={form.allow_notes}
                    disabled={busy}
                    onChange={(e) => change({ allow_notes: e.target.checked })}
                />{' '}
                {t('ltdAi.allowNotes')}
            </label>
            <label className="block">
                <input
                    type="checkbox"
                    checked={form.allow_calendar_titles}
                    disabled={busy}
                    onChange={(e) =>
                        change({ allow_calendar_titles: e.target.checked })
                    }
                />{' '}
                {t('ltdAi.allowTitles')}
            </label>
            <label className="block">
                {t('ltdAi.budget')}
                <input
                    type="number"
                    min={256}
                    max={32000}
                    className="ms-2 rounded border bg-transparent p-2"
                    value={form.token_budget}
                    disabled={busy}
                    onChange={(e) =>
                        change({ token_budget: Number(e.target.value) })
                    }
                />
            </label>
            <button
                type="button"
                className="rounded border px-3 py-2"
                disabled={busy}
                onClick={() =>
                    void act(async () => {
                        setConsent(false);
                        setResult(null);
                        setPreview(await previewAi(form));
                    })
                }
            >
                {t('ltdAi.preview')}
            </button>
            {preview && (
                <div className="space-y-3">
                    <h3 className="font-medium">{t('ltdAi.manifest')}</h3>
                    <p>
                        <bdi>{preview.manifest.provider}</bdi> ·{' '}
                        <bdi>{preview.manifest.model}</bdi> ·{' '}
                        <bdi>{preview.manifest.destination}</bdi>
                    </p>
                    <p>
                        {t('ltdAi.tokenCount', {
                            count: preview.manifest.token_upper_bound,
                        })}
                    </p>
                    {form.feature === 'why' && (
                        <ol className="space-y-1">
                            {preview.manifest.snapshot.whyChain?.map((goal) => (
                                <li key={goal.uid}>
                                    <bdi>{goal.title}</bdi> ·{' '}
                                    {t(
                                        `goals.horizon.${goal.horizon}`,
                                        goal.horizon
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                    <details>
                        <summary>{t('ltdAi.sentData')}</summary>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                            <bdi>
                                {JSON.stringify(
                                    preview.manifest.snapshot,
                                    null,
                                    2
                                )}
                            </bdi>
                        </pre>
                    </details>
                    <label className="block">
                        <input
                            type="checkbox"
                            checked={consent}
                            disabled={busy}
                            onChange={(e) => setConsent(e.target.checked)}
                        />{' '}
                        {t('ltdAi.consent')}
                    </label>
                    <button
                        type="button"
                        className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
                        disabled={busy || !consent}
                        onClick={() =>
                            void act(async () => {
                                setConsent(false);
                                setSaved(false);
                                setResult(await runAi(form, preview.digest));
                                await onChanged();
                            })
                        }
                    >
                        {busy ? t('ltdAi.working') : t('ltdAi.generate')}
                    </button>
                </div>
            )}
            {error && (
                <p role="alert" className="text-red-600">
                    <bdi>{error}</bdi>
                </p>
            )}
            {result?.text && (
                <div className="space-y-2" aria-live="polite">
                    {Object.entries(result.text).map(([k, v]) => (
                        <p key={k}>
                            <bdi>{v}</bdi>
                        </p>
                    ))}
                    {form.feature === 'review' && (
                        <button
                            className="rounded border px-3 py-2"
                            disabled={busy || saved}
                            onClick={() =>
                                void act(async () => {
                                    await saveAiReview(result.text);
                                    setSaved(true);
                                    await refreshPlanning();
                                })
                            }
                        >
                            {t(saved ? 'ltdAi.saved' : 'ltdAi.saveReview')}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
