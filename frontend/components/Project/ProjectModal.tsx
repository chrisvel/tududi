import React, { useState, useEffect, useRef, useCallback } from "react";
import { Area } from "../../entities/Area";
import { Project } from "../../entities/Project";
import ConfirmDialog from "../Shared/ConfirmDialog";
import { useToast } from "../Shared/ToastContext";
import TagInput from "../Tag/TagInput";
import PriorityDropdown from "../Shared/PriorityDropdown";
import { PriorityType } from "../../entities/Task";
import Switch from "../Shared/Switch";
import { useStore } from "../../store/useStore";
import { useTranslation } from "react-i18next";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  onDelete?: (projectId: number) => void;
  project?: Project;
  areas: Area[];
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  project,
  areas,
}) => {
  const [formData, setFormData] = useState<Project>(
    project || {
      name: "",
      description: "",
      area_id: null,
      active: true,
      tags: [],
      priority: "low",
      due_date_at: "",
      image_url: "",
    }
  );

  const [tags, setTags] = useState<string[]>(
    project?.tags?.map((tag) => tag.name) || []
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(project?.image_url || "");
  const [isUploading, setIsUploading] = useState(false);

  const { tagsStore } = useStore();
  const { tags: availableTags, loadTags } = tagsStore;

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { showSuccessToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (project) {
      setFormData({
        ...project,
        tags: project.tags || [],
        due_date_at: project.due_date_at || "",
        image_url: project.image_url || "",
      });
      setTags(project.tags?.map((tag) => tag.name) || []);
      setImagePreview(project.image_url || "");
    } else {
      setFormData({
        name: "",
        description: "",
        area_id: null,
        active: true,
        tags: [],
        priority: "low",
        due_date_at: "",
        image_url: "",
      });
      setTags([]);
      setImagePreview("");
    }
    setImageFile(null);
  }, [project]);

  useEffect(() => {
    if (availableTags.length === 0) {
      loadTags().catch(error => {
        console.error('Error loading tags:', error);
      });
    }
  }, [availableTags.length, loadTags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const target = e.target;
    const { name, type, value } = target;

    if (type === "checkbox") {
      if (target instanceof HTMLInputElement) {
        const checked = target.checked;
        setFormData((prev) => ({
          ...prev,
          [name]: checked,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((name) => ({ name })),
    }));
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async (): Promise<string | null> => {
    if (!imageFile) return null;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/upload/project-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const result = await response.json();
      return result.imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
    setFormData((prev) => ({
      ...prev,
      image_url: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    try {
      let imageUrl = formData.image_url;
      
      // Upload image if a new one was selected
      if (imageFile) {
        const uploadedImageUrl = await handleImageUpload();
        if (uploadedImageUrl) {
          imageUrl = uploadedImageUrl;
        }
      }
      
      const projectData = {
        ...formData,
        image_url: imageUrl,
        tags: tags.map((name) => ({ name }))
      };
      
      // Save the project
      onSave(projectData);
      
      showSuccessToast(
        project
          ? "Project updated successfully!"
          : "Project created successfully!"
      );
      
      handleClose();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (project && project.id && onDelete) {
      onDelete(project.id);
      showSuccessToast(t('success.projectDeleted'));
      setShowConfirmDialog(false);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleToggleActive = () => {
    setFormData((prev) => ({
      ...prev,
      active: !prev.active,
    }));
  };


  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          ref={modalRef}
          className={`bg-white dark:bg-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-2xl overflow-hidden transform transition-transform duration-300 ${
            isClosing ? "scale-95" : "scale-100"
          } flex flex-col`}
          style={{
            height: "calc(100vh - 4rem)",
            maxHeight: "90vh",
          }}
        >
          <form className="flex flex-col h-full">
            <fieldset className="flex flex-col h-full">
              <div className="p-4 space-y-3 flex-1 text-sm overflow-y-auto min-h-0">
                <div className="py-4">
                  <input
                    type="text"
                    id="projectName"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                    placeholder={t('project.name', 'Enter project name')}
                  />
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('forms.description', 'Description')}
                  </label>
                  <textarea
                    id="projectDescription"
                    name="description"
                    rows={4}
                    value={formData.description || ""}
                    onChange={handleChange}
                    className="block w-full rounded-md shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                    placeholder={t('forms.areaDescriptionPlaceholder', 'Enter project description (optional)')}
                  ></textarea>
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('project.projectImage', 'Project Image')}
                  </label>
                  
                  {imagePreview ? (
                    <div className="mb-3">
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Project preview"
                          className="w-32 h-20 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : null}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {t('project.browseImage', 'Browse Image')}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('project.uploadImageHint', 'Upload an image for your project (max 5MB)')}
                  </p>
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('forms.dueDate', 'Due Date')}
                  </label>
                  <input
                    type="date"
                    name="due_date_at"
                    value={formData.due_date_at || ""}
                    onChange={handleChange}
                    className="block w-full rounded-md shadow-sm px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  />
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('forms.priority', 'Priority')}
                  </label>
                  <PriorityDropdown
                    value={formData.priority || "medium"}
                    onChange={(value: PriorityType) =>
                      setFormData({ ...formData, priority: value })
                    }
                  />
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('forms.tags', 'Tags')}
                  </label>
                  <div className="w-full">
                    <TagInput
                      onTagsChange={handleTagsChange}
                      initialTags={tags}
                      availableTags={availableTags}
                    />
                  </div>
                </div>

                <div className="pb-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('common.area', 'Area')} ({t('forms.optional', 'optional')})
                  </label>
                  <select
                    id="projectArea"
                    name="area_id"
                    value={formData.area_id || ""}
                    onChange={handleChange}
                    className="block w-full rounded-md shadow-sm px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  >
                    <option value="">{t('common.none', 'No Area')}</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <Switch
                    isChecked={formData.active}
                    onToggle={handleToggleActive}
                  />
                  <label
                    htmlFor="active"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    {t('projects.active', 'Active')}
                  </label>
                </div>
              </div>

              <div className="p-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
                {project && onDelete && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 focus:outline-none transition duration-150 ease-in-out"
                  >
                    {t('common.delete', 'Delete')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition duration-150 ease-in-out"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : (project ? t('modals.updateProject', 'Update Project') : t('modals.createProject', 'Create Project'))}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>

      {showConfirmDialog && (
        <ConfirmDialog
          title="Delete Project"
          message="Are you sure you want to delete this project? This action cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

    </>
  );
};

export default ProjectModal;