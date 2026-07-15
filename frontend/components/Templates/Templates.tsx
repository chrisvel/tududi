import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusCircleIcon, RectangleStackIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { Template } from '../../entities/Template';
import { Project } from '../../entities/Project';
import {
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    fetchTemplate,
} from '../../utils/templatesService';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TemplateCard from './TemplateCard';
import TemplateCloneModal from './TemplateCloneModal';
import TemplatePreviewModal from './TemplatePreviewModal';
type Tab = 'my' | 'marketplace';

const TemplateEditModal: React.FC<{
    template?: Partial<Template>;
    onSave: (data: Partial<Template>) => void;
    onClose: () => void;
}> = ({ template, onSave, onClose }) => {
    const { t } = useTranslation();
    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [category, setCategory] = useState(template?.template_category || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name: name.trim(), description: description.trim(), template_category: category.trim() || undefined });
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
                    {template?.uid
                        ? t('templates.editTemplate', 'Edit Template')
                        : t('templates.newTemplate', 'New Template')}
                </h3>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('templates.name', 'Name')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('templates.description', 'Description')}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('templates.category', 'Category')}
                        </label>
                        <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder={t('templates.categoryPlaceholder', 'e.g. Sales, HR, Engineering')}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                        >
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Templates: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();

    const [activeTab, setActiveTab] = useState<Tab>('my');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
    const [cloneTarget, setCloneTarget] = useState<Template | null>(null);
    const [previewTarget, setPreviewTarget] = useState<Template | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const results = await fetchTemplates();
            setTemplates(results);
        } catch {
            showErrorToast(t('templates.fetchError', 'Failed to load templates.'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (data: Partial<Template>) => {
        try {
            await createTemplate(data);
            showSuccessToast(t('templates.created', 'Template created.'));
            setEditingTemplate(null);
            loadTemplates();
        } catch {
            showErrorToast(t('templates.createError', 'Failed to create template.'));
        }
    };

    const handleUpdate = async (data: Partial<Template>) => {
        if (!editingTemplate?.uid) return;
        try {
            await updateTemplate(editingTemplate.uid, data);
            showSuccessToast(t('templates.updated', 'Template updated.'));
            setEditingTemplate(null);
            loadTemplates();
        } catch {
            showErrorToast(t('templates.updateError', 'Failed to update template.'));
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.uid) return;
        try {
            await deleteTemplate(deleteTarget.uid);
            showSuccessToast(t('templates.deleted', 'Template deleted.'));
            setDeleteTarget(null);
            loadTemplates();
        } catch {
            showErrorToast(t('templates.deleteError', 'Failed to delete template.'));
        }
    };

    const handleClone = async (template: Template, options: any) => {
        if (!template.uid) return;
        try {
            const project = await cloneTemplate(template.uid, options) as Project;
            showSuccessToast(t('templates.cloned', 'Project "{{name}}" created.', { name: project.name }));
            setCloneTarget(null);
            if (project.uid) {
                navigate(`/project/${project.uid}-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
            }
        } catch {
            showErrorToast(t('templates.cloneError', 'Failed to create project from template.'));
        }
    };

    const handlePreview = async (template: Template) => {
        if (!template.uid) return;
        setLoadingPreview(true);
        try {
            const full = await fetchTemplate(template.uid);
            setPreviewTarget(full);
        } catch {
            showErrorToast(t('templates.previewError', 'Failed to load template preview.'));
        } finally {
            setLoadingPreview(false);
        }
    };

    return (
        <>
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-light">
                        {t('templates.title', 'Templates')}
                    </h2>
                    <button
                        onClick={() => setEditingTemplate({})}
                        className={`flex items-center gap-2 px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors ${activeTab !== 'my' ? 'invisible' : ''}`}
                    >
                        <PlusCircleIcon className="h-4 w-4" />
                        {t('templates.new', 'New Template')}
                    </button>
                </div>

                <div className="flex gap-1 mb-6">
                    <button
                        onClick={() => setActiveTab('my')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'my'
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <RectangleStackIcon className="h-4 w-4" />
                            {t('templates.myTemplates', 'My Templates')}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('marketplace')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === 'marketplace'
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <ShoppingBagIcon className="h-4 w-4" />
                            {t('templates.marketplace.title', 'Marketplace')}
                        </span>
                    </button>
                </div>

                <div>
                {activeTab === 'my' && (
                    loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-16">
                            <RectangleStackIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                {t('templates.empty', 'No templates yet. Create one or save an existing project as a template.')}
                            </p>
                            <button
                                onClick={() => setEditingTemplate({})}
                                className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                            >
                                {t('templates.createFirst', 'Create Your First Template')}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templates.map((tpl) => (
                                <TemplateCard
                                    key={tpl.uid}
                                    template={tpl}
                                    onClone={(t) => setCloneTarget(t)}
                                    onEdit={(t) => setEditingTemplate(t)}
                                    onDelete={(t) => setDeleteTarget(t)}
                                    onPreview={handlePreview}
                                />
                            ))}
                        </div>
                    )
                )}

                {activeTab === 'marketplace' && (
                    <div className="text-center py-16">
                        <ShoppingBagIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                            {t('templates.marketplace.comingSoon', 'Coming Soon')}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {t('templates.marketplace.comingSoonDescription', 'The marketplace is not available yet. Check back later.')}
                        </p>
                    </div>
                )}
            </div>
            </div>
        </div>

        {editingTemplate !== null && (
                <TemplateEditModal
                    template={editingTemplate}
                    onSave={editingTemplate.uid ? handleUpdate : handleCreate}
                    onClose={() => setEditingTemplate(null)}
                />
            )}

            {cloneTarget && (
                <TemplateCloneModal
                    template={cloneTarget}
                    onConfirm={(options) => handleClone(cloneTarget, options)}
                    onClose={() => setCloneTarget(null)}
                />
            )}

            {previewTarget && (
                <TemplatePreviewModal
                    template={previewTarget}
                    onClose={() => setPreviewTarget(null)}
                    onClone={() => {
                        setCloneTarget(previewTarget);
                        setPreviewTarget(null);
                    }}
                />
            )}

            {loadingPreview && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
                </div>
            )}

            {deleteTarget && (
                <ConfirmDialog
                    title={t('templates.confirmDelete', 'Delete Template')}
                    message={t('templates.confirmDeleteMessage', 'Delete "{{name}}"? Projects created from it will not be affected.', { name: deleteTarget.name })}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </>
    );
};

export default Templates;
