import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Person } from '../../entities/Person';
import { updateMember, UpdatedMember } from '../../utils/membersService';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface MemberEditModalProps {
    person: Person;
    onSaved: (member: UpdatedMember) => void;
    onClose: () => void;
}

const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

// Renames a member you added. A member who has no email yet can be given
// one here, which sends them an invitation; an email that is set stays.
// Mounted only while open, so the panel is always open here.
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
    const isDirty =
        name !== first || surname !== rest.join(' ') || email.trim() !== '';

    const handleSubmit = async () => {
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
        <EntitySidePanel
            isOpen
            onClose={onClose}
            eyebrow={t('members.title', 'Member')}
            title={t('members.editTitle', 'Edit member')}
            submitLabel={t('common.save', 'Save')}
            submitTestId="member-edit-submit"
            isSubmitting={submitting}
            isDirty={isDirty}
            error={error}
            onSubmit={handleSubmit}
            testId="member-edit-modal"
        >
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
                        data-testid="member-edit-name"
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
                        data-testid="member-edit-surname"
                    />
                </SidePanelField>
            </div>

            {canAddEmail && (
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
                        data-testid="member-edit-email"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(
                            'members.addEmailHint',
                            'Adding an email sends them an invitation to set a password. It cannot be changed afterwards.'
                        )}
                    </p>
                </SidePanelField>
            )}
        </EntitySidePanel>
    );
};

export default MemberEditModal;
