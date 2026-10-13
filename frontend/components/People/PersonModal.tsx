import React, { useState, useEffect } from 'react';
import { Person, RelationshipType } from '../../entities/Person';
import ColorPicker from '../Shared/ColorPicker';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface PersonModalProps {
    person: Person | null;
    onSave: (data: Partial<Person>) => Promise<void>;
    onClose: () => void;
}

const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
    { value: 'family', label: 'Family' },
    { value: 'work', label: 'Work' },
    { value: 'friend', label: 'Friend' },
    { value: 'other', label: 'Other' },
];

interface PersonFormState {
    name: string;
    relationshipType: RelationshipType;
    email: string;
    phone: string;
    notes: string;
    color: string;
}

const toFormState = (person: Person | null): PersonFormState => ({
    name: person?.name ?? '',
    relationshipType: person?.relationship_type ?? 'other',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    notes: person?.notes ?? '',
    color: person?.color ?? '',
});

// Mounted only while open (the people list and the sidebar both do this),
// so the panel is always open here.
const PersonModal: React.FC<PersonModalProps> = ({
    person,
    onSave,
    onClose,
}) => {
    const [form, setForm] = useState<PersonFormState>(() =>
        toFormState(person)
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm(toFormState(person));
        setError(null);
    }, [person]);

    const setField = <K extends keyof PersonFormState>(
        key: K,
        value: PersonFormState[K]
    ) => setForm((prev) => ({ ...prev, [key]: value }));

    const hasUnsavedChanges = () => {
        const original = toFormState(person);
        return (Object.keys(original) as (keyof PersonFormState)[]).some(
            (key) => form[key] !== original[key]
        );
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            setError('Name is required');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSave({
                name: form.name.trim(),
                relationship_type: form.relationshipType,
                email: form.email.trim() || null,
                phone: form.phone.trim() || null,
                notes: form.notes.trim() || null,
                color: form.color || null,
            });
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : 'Failed to save person'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <EntitySidePanel
            isOpen
            onClose={onClose}
            eyebrow="People"
            title={person ? 'Edit Person' : 'New Person'}
            submitLabel={person ? 'Save Changes' : 'Create Person'}
            isSubmitting={saving}
            isDirty={hasUnsavedChanges()}
            error={error}
            onSubmit={handleSubmit}
            testId="person-panel"
        >
            <SidePanelField label="Name" htmlFor="personName">
                <input
                    id="personName"
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    className={sidePanelInputClass}
                    placeholder="Dad, Partner, Alice..."
                />
            </SidePanelField>

            <SidePanelField label="Relationship" htmlFor="personRelationship">
                <select
                    id="personRelationship"
                    value={form.relationshipType}
                    onChange={(e) =>
                        setField(
                            'relationshipType',
                            e.target.value as RelationshipType
                        )
                    }
                    className={sidePanelInputClass}
                >
                    {RELATIONSHIP_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>
                            {rt.label}
                        </option>
                    ))}
                </select>
            </SidePanelField>

            <SidePanelField label="Email" htmlFor="personEmail">
                <input
                    id="personEmail"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    className={sidePanelInputClass}
                    placeholder="optional@example.com"
                />
            </SidePanelField>

            <SidePanelField label="Phone" htmlFor="personPhone">
                <input
                    id="personPhone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    className={sidePanelInputClass}
                    placeholder="+1 555 000 0000"
                />
            </SidePanelField>

            <SidePanelField label="Notes" htmlFor="personNotes">
                <textarea
                    id="personNotes"
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    rows={3}
                    className={`${sidePanelInputClass} resize-none`}
                    placeholder="Any notes about this person..."
                />
            </SidePanelField>

            <SidePanelSection title="Color">
                <ColorPicker
                    value={form.color}
                    onChange={(color) => setField('color', color)}
                />
            </SidePanelSection>
        </EntitySidePanel>
    );
};

export default PersonModal;
