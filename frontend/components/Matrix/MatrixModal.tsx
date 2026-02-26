import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Matrix } from '../../entities/Matrix';
import { getQuadrantStyle } from '../../constants/matrixColors';

interface MatrixPreset {
    key: string;
    name: string;
    xAxisLeft: string;
    xAxisRight: string;
    yAxisTop: string;
    yAxisBottom: string;
}

const MATRIX_PRESETS: MatrixPreset[] = [
    {
        key: 'eisenhower',
        name: 'Eisenhower',
        xAxisLeft: 'Urgent',
        xAxisRight: 'Not Urgent',
        yAxisTop: 'Important',
        yAxisBottom: 'Not Important',
    },
    {
        key: 'effortImpact',
        name: 'Effort / Impact',
        xAxisLeft: 'Low Effort',
        xAxisRight: 'High Effort',
        yAxisTop: 'High Impact',
        yAxisBottom: 'Low Impact',
    },
    {
        key: 'riskReward',
        name: 'Risk / Reward',
        xAxisLeft: 'Low Risk',
        xAxisRight: 'High Risk',
        yAxisTop: 'High Reward',
        yAxisBottom: 'Low Reward',
    },
];

interface MatrixModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Matrix>) => Promise<void>;
    matrix?: Matrix | null;
}

const MatrixModal: React.FC<MatrixModalProps> = ({
    isOpen,
    onClose,
    onSave,
    matrix,
}) => {
    const { t } = useTranslation();

    const [name, setName] = useState('');
    const [xAxisLeft, setXAxisLeft] = useState('');
    const [xAxisRight, setXAxisRight] = useState('');
    const [yAxisTop, setYAxisTop] = useState('');
    const [yAxisBottom, setYAxisBottom] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const applyPreset = (preset: MatrixPreset) => {
        setName(t(`matrix.preset.${preset.key}`, preset.name));
        setXAxisLeft(preset.xAxisLeft);
        setXAxisRight(preset.xAxisRight);
        setYAxisTop(preset.yAxisTop);
        setYAxisBottom(preset.yAxisBottom);
    };

    useEffect(() => {
        if (matrix) {
            setName(matrix.name);
            setXAxisLeft(matrix.x_axis_label_left);
            setXAxisRight(matrix.x_axis_label_right);
            setYAxisTop(matrix.y_axis_label_top);
            setYAxisBottom(matrix.y_axis_label_bottom);
        } else {
            setName('');
            setXAxisLeft(
                t('matrix.defaultXAxisLeft', 'Low Effort')
            );
            setXAxisRight(
                t('matrix.defaultXAxisRight', 'High Effort')
            );
            setYAxisTop(
                t('matrix.defaultYAxisTop', 'High Impact')
            );
            setYAxisBottom(
                t('matrix.defaultYAxisBottom', 'Low Impact')
            );
        }
        setError('');
    }, [matrix, isOpen, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError(
                t(
                    'matrix.errors.nameRequired',
                    'Matrix name is required'
                )
            );
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            await onSave({
                name: name.trim(),
                x_axis_label_left: xAxisLeft,
                x_axis_label_right: xAxisRight,
                y_axis_label_top: yAxisTop,
                y_axis_label_bottom: yAxisBottom,
            });
            onClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('matrix.errors.saveFailed', 'Failed to save matrix')
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="fixed inset-0 bg-black/50"
                onClick={onClose}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                        {matrix
                            ? t('matrix.edit', 'Edit Matrix')
                            : t('matrix.create', 'Create Matrix')}
                    </h2>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('matrix.name', 'Matrix Name')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t(
                                    'matrix.namePlaceholder',
                                    'e.g., Eisenhower Matrix'
                                )}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                autoFocus
                            />
                        </div>

                        {/* Presets — only show for new matrices */}
                        {!matrix && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {t('matrix.preset.label', 'Quick Preset')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {MATRIX_PRESETS.map((preset) => (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:border-blue-600 dark:hover:text-blue-300 transition-colors"
                                        >
                                            {t(`matrix.preset.${preset.key}`, preset.name)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Axis Labels — arranged to mirror the matrix layout */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('matrix.axisLabels', 'Axis Labels')}
                            </p>

                            {/* Top label (Y-axis top) — centered */}
                            <div className="flex justify-center">
                                <input
                                    type="text"
                                    value={yAxisTop}
                                    onChange={(e) => setYAxisTop(e.target.value)}
                                    placeholder={t('matrix.yAxisTopPlaceholder', 'e.g., Important')}
                                    className="w-48 px-3 py-1.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            {/* Middle row: Left label — mini grid — Right label */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={xAxisLeft}
                                    onChange={(e) => setXAxisLeft(e.target.value)}
                                    placeholder={t('matrix.xAxisLeftPlaceholder', 'e.g., Urgent')}
                                    className="flex-1 px-3 py-1.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />

                                {/* Mini 2×2 visual — Q0 top-left (do first) to Q3 bottom-right (eliminate) */}
                                <div className="grid grid-cols-2 gap-0.5 w-16 h-16 flex-shrink-0">
                                    {[0, 1, 2, 3].map((qi) => (
                                        <div key={qi} className={`rounded-sm ${getQuadrantStyle(qi).bg}`} />
                                    ))}
                                </div>

                                <input
                                    type="text"
                                    value={xAxisRight}
                                    onChange={(e) => setXAxisRight(e.target.value)}
                                    placeholder={t('matrix.xAxisRightPlaceholder', 'e.g., Not Urgent')}
                                    className="flex-1 px-3 py-1.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            {/* Bottom label (Y-axis bottom) — centered */}
                            <div className="flex justify-center">
                                <input
                                    type="text"
                                    value={yAxisBottom}
                                    onChange={(e) => setYAxisBottom(e.target.value)}
                                    placeholder={t('matrix.yAxisBottomPlaceholder', 'e.g., Not Important')}
                                    className="w-48 px-3 py-1.5 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
                            >
                                {isSaving
                                    ? t('common.saving', 'Saving...')
                                    : t('common.save', 'Save')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MatrixModal;
