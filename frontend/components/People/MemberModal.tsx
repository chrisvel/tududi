import React, { useEffect, useState } from 'react';
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
import { getFeatureFlags } from '../../utils/featureFlags';
import { useHostedMode } from '../../hooks/useHostedMode';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface MemberModalProps {
    // A contact to turn into a member. It keeps its history, so tasks that
    // were assigned to it stay assigned.
    person?: Person | null;
    onCreated: (member: CreatedMember) => void;
    onClose: () => void;
}

const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const splitName = (fullName: string) => {
    const [first, ...rest] = fullName.trim().split(/\s+/);
    return { name: first || '', surname: rest.join(' ') };
};

// Mounted only while open, so the panel is always open here.
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
    const hosted = useHostedMode();
    // On tududi Cloud every member is a paid seat on the owner's subscription.
    const [paidSeats, setPaidSeats] = useState(false);

    useEffect(() => {
        getFeatureFlags().then((flags) =>
            setPaidSeats(flags.hosted && flags.billing)
        );
    }, []);

    // Without an email there is nothing to sign in with, so no password and no
    // invitation.
    const hasEmail = email.trim() !== '';
    // Only an admin can create an admin: on tududi Cloud an admin of the
    // account (never the superadmin), elsewhere the instance admin. Anyone else
    // adds a user or a guest.
    const roles: RoleId[] =
        viewerRole === 'account_admin'
            ? ['user', 'guest', 'account_admin']
            : viewerRole === 'admin' && !hosted
              ? ['user', 'guest', 'admin']
              : ['user', 'guest'];

    const isDirty =
        name !== initial.name ||
        surname !== initial.surname ||
        email !== (person?.email ?? '') ||
        password !== '';

    const handleSubmit = async () => {
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
        <EntitySidePanel
            isOpen
            onClose={onClose}
            eyebrow={t('members.title', 'Members')}
            title={
                person
                    ? t(
                          'members.giveAccountTitle',
                          'Give {{name}} an account',
                          {
                              name: person.name,
                          }
                      )
                    : t('members.addTitle', 'Add member')
            }
            submitLabel={
                person
                    ? t('members.giveAccount', 'Give account')
                    : t('members.add', 'Add member')
            }
            submitTestId="member-submit"
            isSubmitting={submitting}
            isDirty={isDirty}
            error={error}
            onSubmit={handleSubmit}
            testId="member-modal"
        >
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
                <SidePanelField
                    label={t('members.name', 'Name')}
                    htmlFor="memberName"
                >
                    <input
                        id="memberName"
                        type="text"
                        className={sidePanelInputClass}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        data-testid="member-name"
                    />
                </SidePanelField>
                <SidePanelField
                    label={t('members.surname', 'Surname')}
                    htmlFor="memberSurname"
                >
                    <input
                        id="memberSurname"
                        type="text"
                        className={sidePanelInputClass}
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        data-testid="member-surname"
                    />
                </SidePanelField>
            </div>

            <SidePanelField
                label={`${t('members.email', 'Email')} (${t('members.optional', 'optional')})`}
                htmlFor="memberEmail"
            >
                <input
                    id="memberEmail"
                    type="email"
                    className={sidePanelInputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="member-email"
                />
                <p
                    className="text-xs text-gray-500 dark:text-gray-400"
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
            </SidePanelField>

            {hasEmail && (
                <SidePanelField
                    label={`${t('members.password', 'Password')} (${t('members.optional', 'optional')})`}
                    htmlFor="memberPassword"
                >
                    <div className="flex gap-2">
                        <input
                            id="memberPassword"
                            type="text"
                            className={sidePanelInputClass}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={8}
                            autoComplete="new-password"
                            data-testid="member-password"
                        />
                        <button
                            type="button"
                            onClick={() => setPassword(generatePassword())}
                            data-testid="member-generate-password"
                            className="whitespace-nowrap rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            {t('members.generate', 'Generate')}
                        </button>
                    </div>
                </SidePanelField>
            )}

            <SidePanelField
                label={t('members.role', 'Role')}
                htmlFor="memberRole"
            >
                <select
                    id="memberRole"
                    className={sidePanelInputClass}
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleId)}
                    data-testid="member-role"
                >
                    {roles.map((id) => (
                        <option key={id} value={id}>
                            {roleName(t, id, hosted)}
                        </option>
                    ))}
                </select>
            </SidePanelField>

            {paidSeats && viewerRole !== 'admin' && (
                <p
                    className="rounded-md bg-blue-50 px-3 py-2 text-sm text-gray-600 dark:bg-blue-900/20 dark:text-gray-300"
                    data-testid="member-seat-note"
                >
                    {t(
                        'members.seatNote',
                        'Each member is one more seat on your subscription. The change is prorated on your next invoice, and removing a member gives the seat back.'
                    )}
                </p>
            )}
        </EntitySidePanel>
    );
};

export default MemberModal;
