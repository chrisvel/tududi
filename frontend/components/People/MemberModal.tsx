import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Person } from '../../entities/Person';
import { RoleId } from '../../entities/Role';
import { useStore } from '../../store/useStore';
import {
    CreatedMember,
    createMember,
    MemberInput,
} from '../../utils/membersService';
import { generatePassword } from '../../utils/passwordPolicy';
import { roleName } from '../Admin/roleLabels';

interface MemberModalProps {
    // A contact to turn into a member. It keeps its history, so tasks that
    // were assigned to it stay assigned.
    person?: Person | null;
    onCreated: (member: CreatedMember) => void;
    onClose: () => void;
}

const inputClass =
    'w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100';

const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const splitName = (fullName: string) => {
    const [first, ...rest] = fullName.trim().split(/\s+/);
    return { name: first || '', surname: rest.join(' ') };
};

const MemberModal: React.FC<MemberModalProps> = ({
    person,
    onCreated,
    onClose,
}) => {
    const { t } = useTranslation();
    const viewerRole = useStore((state) => state.userSettingsStore.role);
    const initial = person ? splitName(person.name) : { name: '', surname: '' };

    const [name, setName] = useState(initial.name);
    const [surname, setSurname] = useState(initial.surname);
    const [email, setEmail] = useState(person?.email ?? '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<RoleId>('user');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Without an email there is nothing to sign in with, so no password and no
    // invitation.
    const hasEmail = email.trim() !== '';
    // Only an admin can create an admin. Anyone else adds a user or a guest.
    const roles: RoleId[] =
        viewerRole === 'admin' ? ['user', 'guest', 'admin'] : ['user', 'guest'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (hasEmail && !isValidEmail(email.trim())) {
            setError(t('errors.invalidEmail', 'Invalid email address'));
            return;
        }
        if (!hasEmail && !name.trim() && !surname.trim()) {
            setError(
                t(
                    'members.nameRequiredWithoutEmail',
                    'Enter a name when there is no email'
                )
            );
            return;
        }

        const input: MemberInput = { role };
        if (name.trim()) input.name = name.trim();
        if (surname.trim()) input.surname = surname.trim();
        if (hasEmail) input.email = email.trim();
        if (hasEmail && password) input.password = password;
        if (person?.uid) input.person_uid = person.uid;

        setSubmitting(true);
        try {
            onCreated(await createMember(input));
            onClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('members.failedToAdd', 'Failed to add member')
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
            data-testid="member-modal"
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {person
                        ? t(
                              'members.giveAccountTitle',
                              'Give {{name}} an account',
                              {
                                  name: person.name,
                              }
                          )
                        : t('members.addTitle', 'Add member')}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {person && (
                        <p
                            className="text-sm text-gray-600 dark:text-gray-300"
                            data-testid="convert-note"
                        >
                            {t(
                                'members.convertNote',
                                'This contact becomes a member and keeps its history, so tasks assigned to them stay assigned. Your private notes on this contact are not carried over.'
                            )}
                        </p>
                    )}
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
                                data-testid="member-name"
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
                                data-testid="member-surname"
                            />
                        </div>
                    </div>
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
                            data-testid="member-email"
                        />
                        <p
                            className="mt-1 text-xs text-gray-500 dark:text-gray-400"
                            data-testid="member-email-hint"
                        >
                            {hasEmail
                                ? t(
                                      'members.emailHint',
                                      'Leave the password blank to send an invitation by email.'
                                  )
                                : t(
                                      'members.noEmailHint',
                                      'Without an email this member cannot sign in yet, but can still be in groups and be assigned tasks. You can add one later.'
                                  )}
                        </p>
                    </div>
                    {hasEmail && (
                        <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {t('members.password', 'Password')}
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                    ({t('members.optional', 'optional')})
                                </span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className={inputClass}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    minLength={8}
                                    autoComplete="new-password"
                                    data-testid="member-password"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPassword(generatePassword())
                                    }
                                    data-testid="member-generate-password"
                                    className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 whitespace-nowrap"
                                >
                                    {t('members.generate', 'Generate')}
                                </button>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {t('members.role', 'Role')}
                        </label>
                        <select
                            className={inputClass}
                            value={role}
                            onChange={(e) => setRole(e.target.value as RoleId)}
                            data-testid="member-role"
                        >
                            {roles.map((id) => (
                                <option key={id} value={id}>
                                    {roleName(t, id)}
                                </option>
                            ))}
                        </select>
                    </div>
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
                            data-testid="member-submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? t('common.saving', 'Saving...')
                                : person
                                  ? t('members.giveAccount', 'Give account')
                                  : t('members.add', 'Add member')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemberModal;
