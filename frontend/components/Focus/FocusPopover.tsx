import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import TagInput from '../Tag/TagInput';
import { applyFocus, Focus } from '../../utils/focus';
import type { Area } from '../../entities/Area';
import type { Project } from '../../entities/Project';
import type { Tag } from '../../entities/Tag';

// Stable fallbacks keep the selectors referentially equal when a store
// slice is absent (page tests stub the store with only what they need).
const NO_AREAS: Area[] = [];
const NO_PROJECTS: Project[] = [];
const NO_TAGS: Tag[] = [];

interface FocusPopoverProps {
    focus: Focus | null;
    onClose: () => void;
}

const FIELD =
    'w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800 dark:text-gray-100';
const LABEL =
    'mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';

// Picks the area, the project inside it and the tags of a Focus. Apply
// saves it for the account; Clear removes it.
const FocusPopover: React.FC<FocusPopoverProps> = ({ focus, onClose }) => {
    const { t } = useTranslation();
    const areas = useStore((state) => state.areasStore?.areas ?? NO_AREAS);
    const projects = useStore(
        (state) => state.projectsStore?.projects ?? NO_PROJECTS
    );
    const availableTags = useStore((state) => state.tagsStore?.tags ?? NO_TAGS);

    const [areaUid, setAreaUid] = useState(focus?.area_uid ?? '');
    const [projectUid, setProjectUid] = useState(focus?.project_uid ?? '');
    const [tags, setTags] = useState<string[]>(focus?.tags ?? []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Only projects of the chosen area can be picked; without an area any
    // project can.
    const projectOptions = useMemo(
        () =>
            projects.filter((project) => {
                if (!areaUid) return true;
                const projectAreaUid = project.area?.uid ?? project.area_uid;
                return projectAreaUid === areaUid;
            }),
        [projects, areaUid]
    );

    const changeArea = (uid: string) => {
        setAreaUid(uid);
        if (
            projectUid &&
            !projects.some((project) => {
                if (project.uid !== projectUid) return false;
                if (!uid) return true;
                return (project.area?.uid ?? project.area_uid) === uid;
            })
        ) {
            setProjectUid('');
        }
    };

    const save = async (next: Focus | null) => {
        setSaving(true);
        setError(null);
        try {
            await applyFocus(next);
            onClose();
        } catch {
            setError(t('focus.saveError', 'Could not save the focus.'));
        } finally {
            setSaving(false);
        }
    };

    const canApply = !!areaUid || !!projectUid || tags.length > 0;

    return (
        <div
            role="dialog"
            aria-label={t('focus.title', 'Focus on')}
            className="fixed inset-x-3 top-16 z-50 rounded-xl bg-white p-4 shadow-xl dark:bg-gray-900 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80"
            data-testid="focus-popover"
        >
            <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('focus.title', 'Focus on')}
            </div>
            <div className="space-y-3">
                <div>
                    <label className={LABEL} htmlFor="focus-area">
                        {t('focus.area', 'Area')}
                    </label>
                    <select
                        id="focus-area"
                        className={FIELD}
                        value={areaUid}
                        onChange={(event) => changeArea(event.target.value)}
                        data-testid="focus-area"
                    >
                        <option value="">
                            {t('focus.anyArea', 'Any area')}
                        </option>
                        {areas.map((area) => (
                            <option key={area.uid} value={area.uid}>
                                {area.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={LABEL} htmlFor="focus-project">
                        {t('focus.project', 'Project')}
                    </label>
                    <select
                        id="focus-project"
                        className={FIELD}
                        value={projectUid}
                        onChange={(event) => setProjectUid(event.target.value)}
                        data-testid="focus-project"
                    >
                        <option value="">
                            {t('focus.anyProject', 'Any project')}
                        </option>
                        {projectOptions.map((project) => (
                            <option key={project.uid} value={project.uid}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <span className={LABEL}>{t('focus.tags', 'Tags')}</span>
                    <TagInput
                        initialTags={tags}
                        onTagsChange={setTags}
                        availableTags={availableTags}
                    />
                </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {t(
                    'focus.hint',
                    'Today, Upcoming, Tasks, Projects, Notes and search show only this. New tasks get the project and tags.'
                )}
            </p>
            {error && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => void save(null)}
                    disabled={saving || !focus}
                    className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
                    data-testid="focus-clear"
                >
                    {t('focus.clear', 'Clear')}
                </button>
                <button
                    type="button"
                    onClick={() =>
                        void save({
                            area_uid: areaUid || null,
                            project_uid: projectUid || null,
                            tags,
                        })
                    }
                    disabled={saving || !canApply}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
                    data-testid="focus-apply"
                >
                    {t('focus.apply', 'Apply')}
                </button>
            </div>
        </div>
    );
};

export default FocusPopover;
