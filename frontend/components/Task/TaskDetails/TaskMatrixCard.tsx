import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Squares2X2Icon,
    ArrowRightIcon,
    ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import {
    fetchTaskMatrices,
    fetchMatrices,
    assignTaskToMatrix,
} from '../../../utils/matrixService';
import { Matrix, TaskMatrixPlacement } from '../../../entities/Matrix';
import { getQuadrantStyle } from '../../../constants/matrixColors';

interface TaskMatrixCardProps {
    taskId?: number;
}

type AddStep = 'idle' | 'pickMatrix' | 'pickQuadrant';

/** Axis-intersection label, e.g. "Important · Urgent". */
function quadrantLabel(
    m: Pick<Matrix, 'x_axis_label_left' | 'x_axis_label_right' | 'y_axis_label_top' | 'y_axis_label_bottom'>,
    qi: number
): string {
    const y = qi < 2 ? m.y_axis_label_top : m.y_axis_label_bottom;
    const x = qi % 2 === 0 ? m.x_axis_label_left : m.x_axis_label_right;
    return `${y} · ${x}`;
}

/** Shared tiny axis-label text style. */
const AXIS_CLS = 'text-[9px] text-gray-400 dark:text-gray-500 truncate';

/* ------------------------------------------------------------------ */
/* Axis-labelled 2×2 grid (shared between read-only + picker)          */
/* ------------------------------------------------------------------ */
const MiniGrid: React.FC<{
    matrix: Pick<Matrix, 'x_axis_label_left' | 'x_axis_label_right' | 'y_axis_label_top' | 'y_axis_label_bottom'>;
    activeQi?: number;
    onClickCell?: (qi: number) => void;
    disabled?: boolean;
}> = ({ matrix, activeQi, onClickCell, disabled }) => (
    <div>
        <div className="flex justify-between mb-1">
            <span className={`${AXIS_CLS} max-w-[45%]`}>{matrix.x_axis_label_left}</span>
            <span className={`${AXIS_CLS} max-w-[45%] text-right`}>{matrix.x_axis_label_right}</span>
        </div>
        <div className="flex items-center gap-1">
            <div className="flex flex-col justify-between h-[72px] mr-0.5">
                <span className={`${AXIS_CLS} leading-none whitespace-nowrap max-w-[40px]`}>
                    {matrix.y_axis_label_top}
                </span>
                <span className={`${AXIS_CLS} leading-none whitespace-nowrap max-w-[40px]`}>
                    {matrix.y_axis_label_bottom}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-0.5 flex-1">
                {[0, 1, 2, 3].map((qi) => {
                    const style = getQuadrantStyle(qi);
                    const isActive = qi === activeQi;
                    const isClickable = !!onClickCell;

                    const cls = isActive
                        ? `${style.bg} ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-300 dark:ring-offset-gray-900 shadow-sm`
                        : isClickable
                          ? `${style.bgSubtle} border border-gray-200 dark:border-gray-600 hover:ring-2 hover:ring-offset-1 hover:ring-gray-400`
                          : 'bg-gray-100 dark:bg-gray-700/50';

                    const Tag = isClickable ? 'button' : 'div';
                    return (
                        <Tag
                            key={qi}
                            disabled={disabled}
                            onClick={isClickable ? () => onClickCell!(qi) : undefined}
                            className={`h-[34px] rounded-sm transition-all ${cls} ${isClickable ? 'cursor-pointer' : ''}`}
                            title={isClickable ? quadrantLabel(matrix, qi) : undefined}
                        >
                            {isActive && (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-2 h-2 rounded-full bg-white/90 shadow-sm" />
                                </div>
                            )}
                        </Tag>
                    );
                })}
            </div>
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/* TaskMatrixCard                                                      */
/* ------------------------------------------------------------------ */
const TaskMatrixCard: React.FC<TaskMatrixCardProps> = ({ taskId }) => {
    const { t } = useTranslation();
    const [placements, setPlacements] = useState<TaskMatrixPlacement[]>([]);
    const [allMatrices, setAllMatrices] = useState<Matrix[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [addStep, setAddStep] = useState<AddStep>('idle');
    const [selectedMatrix, setSelectedMatrix] = useState<Matrix | null>(null);

    /* ---- data loading ---- */
    const loadPlacements = useCallback(async () => {
        if (!taskId) return;
        try {
            const r = await fetchTaskMatrices(taskId);
            setPlacements(r.data || []);
        } catch { /* silent */ }
    }, [taskId]);

    useEffect(() => {
        if (!taskId) { setLoading(false); return; }
        let cancelled = false;
        loadPlacements().finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [taskId, loadPlacements]);

    /* ---- add flow handlers ---- */
    const startAdd = useCallback(async () => {
        setAddStep('pickMatrix');
        try {
            const r = await fetchMatrices();
            setAllMatrices(r.data || []);
        } catch { /* silent */ }
    }, []);

    const pickMatrix = useCallback((m: Matrix) => {
        setSelectedMatrix(m);
        setAddStep('pickQuadrant');
    }, []);

    const pickQuadrant = useCallback(async (qi: number) => {
        if (!taskId || !selectedMatrix?.id) return;
        setSaving(true);
        try {
            await assignTaskToMatrix(selectedMatrix.id, taskId, qi);
            await loadPlacements();
            setAddStep('idle');
            setSelectedMatrix(null);
        } catch { /* silent */ }
        finally { setSaving(false); }
    }, [taskId, selectedMatrix, loadPlacements]);

    const cancel = useCallback(() => {
        setAddStep('idle');
        setSelectedMatrix(null);
    }, []);

    if (loading) return null;

    const existingIds = new Set(placements.map((p) => p.matrix.id!));

    /* ---- render ---- */
    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors overflow-hidden">

            {/* --- Step 1: pick a matrix --- */}
            {addStep === 'pickMatrix' && (() => {
                const available = allMatrices.filter((m) => !existingIds.has(m.id!));
                return (
                    <div className="p-4 space-y-3">
                        <p className={AXIS_CLS}>
                            {t('matrix.actions.selectMatrix', 'Select a matrix')}
                        </p>
                        {available.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                                {t('matrix.actions.noMatricesAvailable', 'No more matrices available')}
                            </p>
                        ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {available.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => pickMatrix(m)}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <Squares2X2Icon className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                            {m.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <button onClick={cancel} className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* --- Step 2: pick a quadrant --- */}
            {addStep === 'pickQuadrant' && selectedMatrix && (
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setAddStep('pickMatrix')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <ChevronLeftIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                        <Squares2X2Icon className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {selectedMatrix.name}
                        </span>
                    </div>
                    <p className={`${AXIS_CLS} ml-7`}>
                        {t('matrix.actions.pickQuadrant', 'Pick a quadrant')}
                    </p>
                    <div className="ml-7">
                        <MiniGrid matrix={selectedMatrix} onClickCell={pickQuadrant} disabled={saving} />
                    </div>
                    <div className="flex justify-end">
                        <button onClick={cancel} className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* --- Idle: placements list or empty state --- */}
            {addStep === 'idle' && (
                <>
                    {placements.length > 0 ? (
                        <div>
                            {placements.map((p) => (
                                <Link
                                    key={p.matrix.id}
                                    to={`/matrices/${p.matrix.id}`}
                                    className="group flex w-full items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getQuadrantStyle(p.quadrant_index).bg}`} />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">
                                                {p.matrix.name}
                                            </span>
                                            <span className={`text-[10px] ${getQuadrantStyle(p.quadrant_index).text}`}>
                                                {quadrantLabel(p.matrix, p.quadrant_index)}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRightIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            ))}
                            <button
                                onClick={startAdd}
                                className="w-full px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-b-lg flex items-center justify-center gap-1"
                            >
                                <Squares2X2Icon className="h-3.5 w-3.5" />
                                {t('matrix.actions.assign', 'Add to matrix')}
                            </button>
                        </div>
                    ) : (
                        <div onClick={startAdd} className="p-6 cursor-pointer">
                            <div className="flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400">
                                <Squares2X2Icon className="h-10 w-10 mb-3 opacity-50" />
                                <span className="text-sm">
                                    {t('matrix.actions.assign', 'Add to matrix')}
                                </span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TaskMatrixCard;
