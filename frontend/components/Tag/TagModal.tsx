import React, { useState, useEffect } from 'react';
import { Tag } from '../../entities/Tag';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import ColorPicker from '../Shared/ColorPicker';
import EntitySidePanel from '../SidePanel/EntitySidePanel';
import {
    SidePanelField,
    SidePanelSection,
    sidePanelInputClass,
} from '../SidePanel/SidePanelParts';

interface TagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tag: Tag) => void;
    onDelete?: (tagUid: string) => void;
    tag?: Tag | null;
}

const toFormData = (tag?: Tag | null): Tag => tag || { name: '' };

const TagModal: React.FC<TagModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    tag,
}) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Tag>(() => toFormData(tag));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showSuccessToast, showErrorToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setFormData(toFormData(tag));
            setError(null);
        }
    }, [tag, isOpen]);

    const isSystemTag = tag?.tag_type === 'system';

    const hasUnsavedChanges = () => {
        if (!tag) {
            return (
                formData.name.trim() !== '' ||
                !!formData.color ||
                !!formData.pinned
            );
        }
        return (
            formData.name !== tag.name ||
            formData.pinned !== tag.pinned ||
            formData.color !== tag.color
        );
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            setError(t('errors.tagNameRequired', 'Tag name is required.'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSave(formData);
            showSuccessToast(
                tag
                    ? t('success.tagUpdated', 'Tag updated successfully!')
                    : t('success.tagCreated', 'Tag created successfully!')
            );
            onClose();
        } catch (err: any) {
            const message =
                err?.message ||
                t('errors.failedToSaveTag', 'Failed to save tag.');
            setError(message);
            showErrorToast(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTag = async () => {
        if (tag?.uid && onDelete) {
            try {
                await onDelete(tag.uid);
                showSuccessToast(
                    t('success.tagDeleted', 'Tag deleted successfully!')
                );
                onClose();
            } catch {
                showErrorToast(
                    t('errors.failedToDeleteTag', 'Failed to delete tag.')
                );
            }
        }
    };

    return (
        <EntitySidePanel
            isOpen={isOpen}
            onClose={onClose}
            eyebrow={tag ? t('tags.title', 'Tags') : undefined}
            title={
                tag
                    ? formData.name ||
                      t('forms.tagNamePlaceholder', 'Enter tag name')
                    : t('modals.createTag', 'Create Tag')
            }
            submitLabel={
                tag
                    ? t('modals.updateTag', 'Update Tag')
                    : t('modals.createTag', 'Create Tag')
            }
            submitTestId="tag-save-button"
            isSubmitting={isSubmitting}
            isDirty={hasUnsavedChanges()}
            error={error}
            onSubmit={handleSubmit}
            onDelete={
                tag?.uid && onDelete && !isSystemTag
                    ? handleDeleteTag
                    : undefined
            }
            testId="tag-panel"
        >
            <SidePanelField label={t('forms.name', 'Name')} htmlFor="tagName">
                <input
                    id="tagName"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                        }))
                    }
                    required
                    readOnly={isSystemTag}
                    className={`${sidePanelInputClass} ${isSystemTag ? 'cursor-default opacity-70' : ''}`}
                    placeholder={t(
                        'forms.tagNamePlaceholder',
                        'Enter tag name'
                    )}
                    data-testid="tag-name-input"
                />
            </SidePanelField>

            <SidePanelSection title={t('tags.pinTag', 'Quick access')}>
                <button
                    type="button"
                    onClick={() =>
                        setFormData((prev) => ({
                            ...prev,
                            pinned: !prev.pinned,
                        }))
                    }
                    aria-pressed={!!formData.pinned}
                    className={`rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        formData.pinned
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                    data-testid="tag-pin-toggle"
                >
                    {formData.pinned
                        ? t('tags.pinned', 'Pinned for quick access')
                        : t('tags.pinTag', 'Pin for quick access')}
                </button>
            </SidePanelSection>

            <SidePanelSection title={t('forms.color', 'Color')}>
                <ColorPicker
                    value={formData.color || ''}
                    onChange={(color) =>
                        setFormData((prev) => ({
                            ...prev,
                            color: color || undefined,
                        }))
                    }
                />
            </SidePanelSection>
        </EntitySidePanel>
    );
};

export default TagModal;
