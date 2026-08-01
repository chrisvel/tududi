import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Person, RelationshipType } from '../../entities/Person';
import ColorPicker from '../Shared/ColorPicker';

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

const PersonModal: React.FC<PersonModalProps> = ({ person, onSave, onClose }) => {
    const [name, setName] = useState('');
    const [relationshipType, setRelationshipType] = useState<RelationshipType>('other');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [color, setColor] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [relationshipOpen, setRelationshipOpen] = useState(false);
    const [relationshipPos, setRelationshipPos] = useState({ top: 0, left: 0, width: 0 });
    const relationshipRef = useRef<HTMLDivElement>(null);
    const relationshipMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (person) {
            setName(person.name ?? '');
            setRelationshipType(person.relationship_type ?? 'other');
            setEmail(person.email ?? '');
            setPhone(person.phone ?? '');
            setNotes(person.notes ?? '');
            setColor(person.color ?? '');
        } else {
            setName('');
            setRelationshipType('other');
            setEmail('');
            setPhone('');
            setNotes('');
            setColor('');
        }
        setError(null);
    }, [person]);

    const handleRelationshipToggle = () => {
        if (!relationshipOpen && relationshipRef.current) {
            const rect = relationshipRef.current.getBoundingClientRect();
            setRelationshipPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
        setRelationshipOpen((o) => !o);
    };

    useEffect(() => {
        if (!relationshipOpen) return;
        const handler = (e: MouseEvent) => {
            if (
                !relationshipRef.current?.contains(e.target as Node) &&
                !relationshipMenuRef.current?.contains(e.target as Node)
            ) {
                setRelationshipOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [relationshipOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSave({
                name: name.trim(),
                relationship_type: relationshipType,
                email: email.trim() || null,
                phone: phone.trim() || null,
                notes: notes.trim() || null,
                color: color || null,
            });
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save person';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {person ? 'Edit Person' : 'New Person'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        aria-label="Close"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Dad, Partner, Alice..."
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Relationship
                        </label>
                        <div ref={relationshipRef} className="relative w-full">
                            <button
                                type="button"
                                onClick={handleRelationshipToggle}
                                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none"
                            >
                                <span>
                                    {RELATIONSHIP_TYPES.find((r) => r.value === relationshipType)?.label ?? 'Other'}
                                </span>
                                <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-300 ml-2 mt-0.5" />
                            </button>
                            {relationshipOpen &&
                                createPortal(
                                    <div
                                        ref={relationshipMenuRef}
                                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600"
                                        style={{
                                            top: `${relationshipPos.top}px`,
                                            left: `${relationshipPos.left}px`,
                                            width: `${relationshipPos.width}px`,
                                        }}
                                    >
                                        {RELATIONSHIP_TYPES.map((rt) => (
                                            <button
                                                key={rt.value}
                                                type="button"
                                                onClick={() => {
                                                    setRelationshipType(rt.value);
                                                    setRelationshipOpen(false);
                                                }}
                                                className={`flex items-center px-4 py-2 text-sm w-full first:rounded-t-md last:rounded-b-md ${
                                                    rt.value === relationshipType
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {rt.label}
                                            </button>
                                        ))}
                                    </div>,
                                    document.body
                                )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="optional@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="+1 555 000 0000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="Any notes about this person..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Color
                        </label>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : person ? 'Save Changes' : 'Create Person'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PersonModal;
