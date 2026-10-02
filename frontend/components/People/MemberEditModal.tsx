import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Person } from '../../entities/Person';
import { updateMember, UpdatedMember } from '../../utils/membersService';

interface MemberEditModalProps {
    person: Person;
    onSaved: (member: UpdatedMember) => void;
    onClose: () => void;
}

const inputClass =
    'w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100';

const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

// Renames a member you added. A member who has no email yet can be given
// one here, which sends them an invitation; an email that is set stays.
const MemberEditModal: React.FC<MemberEditModalProps> = ({
    person,
    onSaved,
    onClose,
}) => {
    const { t } = useTranslation();
    const [first, ...rest] = person.name.trim().split(/\s+/);
    const [name, setName] = useState(first || '');
    const [surname, setSurname] = useState(rest.join(' '));
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canAddEmail = person.account_status === 'no_sign_in';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim() && !surname.trim()) {
            setError(t('members.nameRequired', 'Enter a name'));
            return;
        }
        if (email.trim() && !isValidEmail(email.trim())) {
            setError(t('errors.invalidEmail', 'Invalid email address'));
            return;
        }
        if (person.linked_user_id == null) return;

        setSubmitting(true);
        try {
            const saved = await updateMember(person.linked_user_id, {
                name: name.trim(),
                surname: surname.trim(),
                ...(email.trim() ? { email: email.trim() } : {}),
            });
            onSaved(saved);
            onClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('members.failedToUpdate', 'Failed to update member')
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
            data-testid="member-edit-modal"
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('members.editTitle', 'Edit member')}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {t('members.name', 'Name')}
                            </label>
                            <input
                                type="text"
                                className={inputClass}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                data-testid="member-edit-name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {t('members.surname', 'Surname')}
                            </label>
                            <input
                                type="text"
                                className={inputClass}
                                value={surname}
                                onChange={(e) => setSurname(e.target.value)}
                                data-testid="member-edit-surname"
                            />
                        </div>
                    </div>
                    {canAddEmail && (
                        <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {t('members.email', 'Email')}
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                    ({t('members.optional', 'optional')})
                                </span>
                            </label>
                            <input
                                type="email"
                                className={inputClass}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                data-testid="member-edit-email"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'members.addEmailHint',
                                    'Adding an email sends them an invitation to set a password. It cannot be changed afterwards.'
                                )}
                            </p>
                        </div>
                    )}
                    {error && (
                        <div
                            className="text-sm text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            data-testid="member-edit-submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? t('common.saving', 'Saving...')
                                : t('common.save', 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemberEditModal;
