// Life-to-Day (T-1103): the four-box lesson form (blueprint 14.7) in the
// shared side panel: what I expected, what happened, if, then. Only the
// title is needed; if and then go together. Days are picked in the active
// calendar and saved as ISO Gregorian days. Delete offers Undo.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';
import DatePicker from '../Shared/DatePicker';
import { useToast } from '../Shared/ToastContext';
import { useStore } from '../../store/useStore';
import { revertJournal } from '../../utils/planningService';
import {
    Lesson,
    LessonLink,
    LessonLinkType,
    LessonStatus,
    createLesson,
    deleteLesson,
    refreshLessons,
    updateLesson,
} from '../../utils/lessonsService';

interface LessonPanelProps {
    isOpen: boolean;
    lesson: Lesson | null;
    // A new lesson can start linked, e.g. from a goal page.
    initialLinks?: LessonLink[];
    onClose: () => void;
    onChanged?: () => void;
}

interface FormState {
    title: string;
    expected: string;
    happened: string;
    if_text: string;
    then_text: string;
    learned_on: string;
    review_on: string;
    status: LessonStatus;
    links: LessonLink[];
}

const today = () => new Date().toLocaleDateString('en-CA');
const plusDays = (day: string, days: number) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
const toForm = (lesson: Lesson | null, links: LessonLink[] = []): FormState => {
    const learned = lesson?.learned_on ?? today();
    return {
        title: lesson?.title ?? '',
        expected: lesson?.expected ?? '',
        happened: lesson?.happened ?? '',
        if_text: lesson?.if_text ?? '',
        then_text: lesson?.then_text ?? '',
        learned_on: learned,
        review_on: lesson ? (lesson.review_on ?? '') : plusDays(learned, 14),
        status: lesson?.status ?? 'active',
        links: lesson?.links ?? links,
    };
};
const linkKey = (link: LessonLink) => `${link.type}:${link.uid}`;

const LessonPanel: React.FC<LessonPanelProps> = ({
    isOpen,
    lesson,
    initialLinks,
    onClose,
    onChanged,
}) => {
    const { t } = useTranslation();
    const { showErrorToast, showSuccessToast, showUndoToast } = useToast();
    const goals = useStore((s: any) => s.goalsStore.goals) as any[];
    const projects = useStore((s: any) => s.projectsStore.projects) as any[];
    const areas = useStore((s: any) => s.areasStore.areas) as any[];
    const tags = useStore((s: any) => s.tagsStore.tags) as any[];
    const loadGoals = useStore((s: any) => s.goalsStore.loadGoals);
    const loadProjects = useStore((s: any) => s.projectsStore.loadProjects);
    const loadAreas = useStore((s: any) => s.areasStore.loadAreas);
    const loadTags = useStore((s: any) => s.tagsStore.loadTags);
    const [form, setForm] = useState<FormState>(() =>
        toForm(lesson, initialLinks)
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setForm(toForm(lesson, initialLinks));
        setError(null);
        for (const load of [loadGoals, loadProjects, loadAreas, loadTags])
            void load?.();
        // initialLinks is read once per opening, like the lesson.
    }, [isOpen, lesson, loadGoals, loadProjects, loadAreas, loadTags]);

    const isEdit = !!lesson;
    const original = toForm(lesson, initialLinks);
    const dirty = JSON.stringify(form) !== JSON.stringify(original);
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const options: { type: LessonLinkType; label: string; rows: any[] }[] = [
        {
            type: 'goal',
            label: t('ltdLessons.links.goals', 'Goals'),
            rows: goals.map((g) => ({ uid: g.uid, title: g.title })),
        },
        {
            type: 'project',
            label: t('ltdLessons.links.projects', 'Projects'),
            rows: projects.map((p) => ({ uid: p.uid, title: p.name })),
        },
        {
            type: 'area',
            label: t('ltdLessons.links.areas', 'Areas'),
            rows: areas.map((a) => ({ uid: a.uid, title: a.name })),
        },
        {
            type: 'tag',
            label: t('ltdLessons.links.tags', 'Tags'),
            rows: tags.map((tag) => ({ uid: tag.uid, title: tag.name })),
        },
    ];
    const chosen = new Set(form.links.map(linkKey));
    const titleOf = (link: LessonLink) =>
        link.title ??
        options
            .find((o) => o.type === link.type)
            ?.rows.find((r) => r.uid === link.uid)?.title ??
        link.uid;

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            setError(t('ltdLessons.titleRequired', 'A title is required'));
            return;
        }
        if (!!form.if_text.trim() !== !!form.then_text.trim()) {
            setError(
                t(
                    'ltdLessons.ifThenTogether',
                    'Write both “if” and “then”, or leave both empty.'
                )
            );
            return;
        }
        setSaving(true);
        setError(null);
        const payload = {
            title: form.title,
            expected: form.expected || null,
            happened: form.happened || null,
            if_text: form.if_text || null,
            then_text: form.then_text || null,
            learned_on: form.learned_on,
            review_on: form.review_on || null,
            links: form.links.map(({ type, uid }) => ({ type, uid })),
            ...(isEdit ? { status: form.status } : {}),
        };
        try {
            const saved = isEdit
                ? await updateLesson(lesson!.uid, payload)
                : await createLesson(payload);
            if (saved.warning === 'three_is_enough')
                showSuccessToast(
                    t(
                        'ltdLessons.threeIsEnough',
                        'Saved. Would three be enough? This goal now has more than three active lessons.'
                    )
                );
            onChanged?.();
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!lesson) return;
        try {
            const { journal_uid } = await deleteLesson(lesson.uid);
            onChanged?.();
            onClose();
            showUndoToast(
                t('ltdLessons.deleted', 'Lesson deleted'),
                () =>
                    void revertJournal(journal_uid)
                        .then(() => {
                            void refreshLessons();
                            onChanged?.();
                        })
                        .catch(() =>
                            showErrorToast(
                                t('ltdLife.undoFailed', 'Could not undo')
                            )
                        )
            );
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const box = (
        key: 'expected' | 'happened' | 'if_text' | 'then_text',
        label: string,
        placeholder: string
    ) => (
        <SidePanelField label={label} htmlFor={`lesson-${key}`}>
            <textarea
                id={`lesson-${key}`}
                rows={3}
                value={form[key]}
                maxLength={10000}
                placeholder={placeholder}
                onChange={(e) => set(key, e.target.value)}
                className={sidePanelInputClass}
                data-testid={`lesson-${key}`}
            />
        </SidePanelField>
    );

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={t('ltdLessons.lesson', 'Lesson')}
            title={
                isEdit
                    ? form.title || t('ltdLessons.edit', 'Edit lesson')
                    : t('ltdLessons.new', 'New lesson')
            }
            submitLabel={t('ltdLife.save', 'Save')}
            submitTestId="lesson-save-button"
            isSubmitting={saving}
            isDirty={dirty}
            error={error}
            onSubmit={handleSubmit}
            onDelete={isEdit ? handleDelete : undefined}
            deleteLabel={t('ltdLife.delete', 'Delete')}
            testId="lesson-panel"
        >
            <SidePanelField
                label={t('ltdLessons.fields.title', 'The lesson in one line')}
                htmlFor="lesson-title"
            >
                <input
                    id="lesson-title"
                    type="text"
                    value={form.title}
                    maxLength={255}
                    onChange={(e) => set('title', e.target.value)}
                    className={sidePanelInputClass}
                    data-testid="lesson-title-input"
                />
            </SidePanelField>
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                {box(
                    'expected',
                    t('ltdLessons.fields.expected', 'What I expected'),
                    t('ltdLessons.placeholders.expected', 'I thought…')
                )}
                {box(
                    'happened',
                    t('ltdLessons.fields.happened', 'What happened'),
                    t(
                        'ltdLessons.placeholders.happened',
                        'It went well, or not…'
                    )
                )}
                {box(
                    'if_text',
                    t('ltdLessons.fields.if', 'If…'),
                    t('ltdLessons.placeholders.if', 'When this happens again')
                )}
                {box(
                    'then_text',
                    t('ltdLessons.fields.then', 'Then…'),
                    t('ltdLessons.placeholders.then', 'I will do this')
                )}
            </div>
            <SidePanelField
                label={t('ltdLessons.fields.learnedOn', 'Learned on')}
            >
                <DatePicker
                    value={form.learned_on}
                    onChange={(value) => set('learned_on', value)}
                    placeholder={t('ltdLessons.fields.learnedOn', 'Learned on')}
                />
            </SidePanelField>
            <SidePanelField
                label={t('ltdLessons.fields.reviewOn', 'Look at it again on')}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <DatePicker
                        value={form.review_on}
                        onChange={(value) => set('review_on', value)}
                        placeholder={t('ltdLessons.noReview', 'No review')}
                    />
                    {form.review_on && (
                        <button
                            type="button"
                            onClick={() => set('review_on', '')}
                            className="min-h-[44px] text-sm text-gray-600 hover:underline dark:text-gray-400"
                            data-testid="lesson-clear-review"
                        >
                            {t('ltdLessons.noReview', 'No review')}
                        </button>
                    )}
                </div>
            </SidePanelField>
            <SidePanelField
                label={t('ltdLessons.fields.links', 'Where it applies')}
                htmlFor="lesson-link-add"
            >
                {form.links.length > 0 && (
                    <ul className="mb-2 flex flex-wrap gap-2">
                        {form.links.map((link) => (
                            <li
                                key={linkKey(link)}
                                className="flex min-h-[32px] items-center gap-1 rounded-full bg-gray-100 ps-3 pe-1 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            >
                                <span className="text-gray-500 dark:text-gray-400">
                                    {t(
                                        `ltdLessons.links.${link.type}`,
                                        link.type
                                    )}
                                    :
                                </span>{' '}
                                <bdi>{titleOf(link)}</bdi>
                                <button
                                    type="button"
                                    onClick={() =>
                                        set(
                                            'links',
                                            form.links.filter(
                                                (l) =>
                                                    linkKey(l) !== linkKey(link)
                                            )
                                        )
                                    }
                                    aria-label={t(
                                        'ltdLessons.links.remove',
                                        'Remove link'
                                    )}
                                    className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <select
                    id="lesson-link-add"
                    value=""
                    onChange={(e) => {
                        const [type, uid] = e.target.value.split(':');
                        if (!uid || chosen.has(e.target.value)) return;
                        set('links', [
                            ...form.links,
                            { type: type as LessonLinkType, uid },
                        ]);
                    }}
                    className={sidePanelInputClass}
                    data-testid="lesson-link-select"
                >
                    <option value="">
                        {t(
                            'ltdLessons.links.add',
                            'Add a goal, project, area or tag'
                        )}
                    </option>
                    {options
                        .filter((o) => o.rows.length)
                        .map((o) => (
                            <optgroup key={o.type} label={o.label}>
                                {o.rows
                                    .filter(
                                        (r) => !chosen.has(`${o.type}:${r.uid}`)
                                    )
                                    .map((r) => (
                                        <option
                                            key={r.uid}
                                            value={`${o.type}:${r.uid}`}
                                        >
                                            {r.title}
                                        </option>
                                    ))}
                            </optgroup>
                        ))}
                </select>
                {form.links.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'ltdLessons.links.hint',
                            'A lesson without a link stays in your Life list and does not show on tasks.'
                        )}
                    </p>
                )}
            </SidePanelField>
            {isEdit && (
                <SidePanelField
                    label={t('ltdLessons.fields.status', 'Status')}
                    htmlFor="lesson-status"
                >
                    <select
                        id="lesson-status"
                        value={form.status}
                        onChange={(e) =>
                            set('status', e.target.value as LessonStatus)
                        }
                        className={sidePanelInputClass}
                    >
                        {(['active', 'parked', 'retired'] as const).map((s) => (
                            <option key={s} value={s}>
                                {t(`ltdLessons.status.${s}`, s)}
                            </option>
                        ))}
                    </select>
                </SidePanelField>
            )}
        </EntitySidePanel>
    );
};

export default LessonPanel;
