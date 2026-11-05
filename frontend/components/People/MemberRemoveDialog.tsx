import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    fetchMemberHandoff,
    MemberHandoff,
} from '../../utils/membersService';
import { sidePanelInputClass } from '../SidePanel/SidePanelParts';

interface MemberRemoveDialogProps {
    memberId: number;
    memberName: string;
    // The member id that takes over the open tasks, or null to leave them
    // unassigned.
    onConfirm: (reassignTo: number | null) => void;
    onCancel: () => void;
}

const UNASSIGNED = '';

// Confirms removing a member. When they still have open tasks, it says how
// many and asks who takes them over, starting with the person removing.
const MemberRemoveDialog: React.FC<MemberRemoveDialogProps> = ({
    memberId,
    memberName,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [handoff, setHandoff] = useState<MemberHandoff | null>(null);
    const [loading, setLoading] = useState(true);
    const [target, setTarget] = useState<string>(UNASSIGNED);

    useEffect(() => {
        let cancelled = false;
        fetchMemberHandoff(memberId)
            .then((data) => {
                if (cancelled) return;
                setHandoff(data);
                const first =
                    data.candidates.find((c) => c.is_self) ??
                    data.candidates[0];
                setTarget(first ? String(first.id) : UNASSIGNED);
            })
            .catch(() => {
                // Without the count the dialog still removes, as it did
                // before tasks could be handed over.
                if (!cancelled) setHandoff(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [memberId]);

    const openCount = handoff?.open_assigned_tasks ?? 0;
    const showPicker = openCount > 0;

    const handleConfirm = () => {
        onConfirm(showPicker && target !== UNASSIGNED ? Number(target) : null);
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onCancel}
        >
            <div
                className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-lg mx-4"
                onClick={(e) => e.stopPropagation()}
                data-testid="member-remove-dialog"
            >
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    {t('members.remove', 'Remove member')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                    {t('members.removeConfirm', {
                        defaultValue:
                            'Remove {{name}}? Their account and everything in it is deleted, and this cannot be undone. On tududi Cloud their seat is taken off your subscription.',
                        name: memberName,
                    })}
                </p>

                {showPicker && handoff && (
                    <div
                        className="mb-8 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/60"
                        data-testid="member-remove-handoff"
                    >
                        <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t('members.openTasksCount', {
                                defaultValue:
                                    'Open tasks assigned to {{name}}: {{count}}',
                                name: memberName,
                                count: openCount,
                            })}
                        </p>
                        <label
                            htmlFor="memberHandoffTarget"
                            className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                        >
                            {t('members.handTo', 'Hand their tasks to')}
                        </label>
                        <select
                            id="memberHandoffTarget"
                            className={sidePanelInputClass}
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            data-testid="member-remove-handoff-select"
                        >
                            {handoff.candidates.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                    {c.is_self
                                        ? t('members.handToYou', {
                                              defaultValue: '{{name}} (you)',
                                              name: c.name,
                                          })
                                        : c.name}
                                </option>
                            ))}
                            <option value={UNASSIGNED}>
                                {t(
                                    'members.leaveUnassigned',
                                    'Nobody, leave them unassigned'
                                )}
                            </option>
                        </select>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'members.handToHint',
                                'They get one notice with the number of tasks. Done tasks stay as they are.'
                            )}
                        </p>
                    </div>
                )}
                {!showPicker && <div className="mb-2" />}

                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
                        data-testid="confirm-dialog-cancel"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none disabled:opacity-50"
                        data-testid="confirm-dialog-confirm"
                    >
                        {t('members.remove', 'Remove member')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MemberRemoveDialog;
