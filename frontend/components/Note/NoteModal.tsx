import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import { useToast } from '../Shared/ToastContext';
import TagInput from '../Tag/TagInput';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { Tag } from '../../entities/Tag';
import { fetchTags } from '../../utils/tagsService'; 
import { useTranslation } from 'react-i18next';
import { EyeIcon, PencilIcon, FolderIcon, TagIcon, TrashIcon } from '@heroicons/react/24/outline';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: Note | null;
  onSave: (noteData: Note) => Promise<void>;
  onDelete?: (noteId: number) => Promise<void>;
  projects?: Project[];
  onCreateProject?: (name: string) => Promise<Project>;
}

const NoteModal: React.FC<NoteModalProps> = ({ isOpen, onClose, note, onSave, onDelete, projects = [], onCreateProject }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Note>({
    id: note?.id || 0,
    title: note?.title || '',
    content: note?.content || '',
    tags: note?.tags || [],
  });
  const [tags, setTags] = useState<string[]>(note?.tags?.map((tag) => tag.name) || []);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  
  // Project-related state
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    tags: false,
    project: false,
  });

  const { showSuccessToast, showErrorToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    
    const loadTags = async () => {
      try {
        const data = await fetchTags();
        setAvailableTags(data);
      } catch (error) {
        console.error('Failed to fetch tags', error);
        showErrorToast('Failed to load tags');
      }
    };

    loadTags();
  }, [isOpen, showErrorToast]);

  // Initialize filtered projects from props - like TaskModal
  useEffect(() => {
    setFilteredProjects(projects || []);
  }, [projects]);

  // Initialize form data when modal opens - exactly like TaskModal
  useEffect(() => {
    if (isOpen) {
      // Initialize form data
      const tagNames = note?.tags?.map((tag) => tag.name) || [];
      setFormData({
        id: note?.id || 0,
        title: note?.title || '',
        content: note?.content || '',
        tags: note?.tags || [],
      });
      setTags(tagNames);
      setError(null);
      
      // Initialize project name from note - exactly like TaskModal
      const currentProject = projects?.find((project) => project.id === (note?.project?.id || note?.Project?.id));
      setNewProjectName(currentProject ? currentProject.name : '');
    }
  }, [isOpen, note, projects]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  }, [onClose]);

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
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((name) => ({ name })),
    }));
  }, []);

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => {
      const newExpanded = {
        ...prev,
        [section]: !prev[section]
      };
      
      // Auto-scroll to show the expanded section
      if (newExpanded[section]) {
        setTimeout(() => {
          const scrollContainer = document.querySelector('.absolute.inset-0.overflow-y-auto');
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 100); // Small delay to ensure DOM is updated
      }
      
      return newExpanded;
    });
  }, []);

  const handleProjectSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewProjectName(value);
    setDropdownOpen(true);
    
    if (!projects || projects.length === 0) {
      setFilteredProjects([]);
      return;
    }
    
    const query = value.toLowerCase();
    const filtered = projects.filter((project) =>
      project.name.toLowerCase().includes(query)
    );
    setFilteredProjects(filtered);
  };

  const handleProjectSelection = (project: Project) => {
    setFormData(prev => ({ 
      ...prev, 
      project: { id: project.id!, name: project.name },
      project_id: project.id 
    }));
    setNewProjectName(project.name);
    setDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim() !== "" && onCreateProject) {
      setIsCreatingProject(true);
      try {
        const newProject = await onCreateProject(newProjectName.trim());
        setFormData(prev => ({ 
          ...prev, 
          project: { id: newProject.id!, name: newProject.name },
          project_id: newProject.id 
        }));
        setFilteredProjects([...filteredProjects, newProject]);
        setNewProjectName(newProject.name);
        setDropdownOpen(false);
        showSuccessToast(t('success.projectCreated'));
      } catch (error) {
        showErrorToast(t('errors.projectCreationFailed'));
        console.error("Error creating project:", error);
      } finally {
        setIsCreatingProject(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError(t('errors.noteTitleRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Convert string tags to tag objects
      const noteTags: Tag[] = tags.map(tagName => ({ name: tagName }));
      
      // Create final form data with the tags
      const finalFormData = { ...formData, tags: noteTags };
      
      await onSave(finalFormData);
      showSuccessToast(formData.id && formData.id !== 0 ? t('success.noteUpdated') : t('success.noteCreated'));
      handleClose();
    } catch (err) {
      setError((err as Error).message);
      showErrorToast(t('errors.failedToSaveNote'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async () => {
    if (formData.id && formData.id !== 0 && onDelete) {
      try {
        await onDelete(formData.id);
        showSuccessToast(t('success.noteDeleted'));
        handleClose();
      } catch (err) {
        setError((err as Error).message);
        showErrorToast(t('errors.failedToDeleteNote'));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-hidden sm:overflow-y-auto ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="h-full flex items-start justify-center sm:px-4 sm:py-4">
          <div
            ref={modalRef}
            className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-2xl transform transition-transform duration-300 ${
              isClosing ? "scale-95" : "scale-100"
            } h-full sm:h-auto sm:my-4`}
          >
            <div className="flex flex-col h-full sm:min-h-[600px] sm:max-h-[90vh]">
              {/* Main Form Section */}
              <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800">
                <div className="flex-1 relative">
                  <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <form className="h-full">
                      <fieldset className="h-full flex flex-col">
                        {/* Note Title Section - Always Visible */}
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 pt-4">
                          <input
                            type="text"
                            id="noteTitle"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                            placeholder={t('forms.noteTitlePlaceholder')}
                          />
                        </div>

                        {/* Content Section - Always Visible */}
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t('forms.noteContent')} <span className="text-gray-500">(Markdown supported)</span>
                            </label>
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={() => setActiveTab('edit')}
                                className={`px-3 py-1 text-xs rounded-md flex items-center space-x-1 transition-colors ${
                                  activeTab === 'edit'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                              >
                                <PencilIcon className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                className={`px-3 py-1 text-xs rounded-md flex items-center space-x-1 transition-colors ${
                                  activeTab === 'preview'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                              >
                                <EyeIcon className="h-3 w-3" />
                                <span>Preview</span>
                              </button>
                            </div>
                          </div>
                          
                          {activeTab === 'edit' ? (
                            <textarea
                              id="noteContent"
                              name="content"
                              value={formData.content}
                              onChange={handleChange}
                              rows={15}
                              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out resize-none"
                              placeholder="Write your content using Markdown formatting...&#10;&#10;Examples:&#10;# Heading&#10;**Bold text**&#10;*Italic text*&#10;- List item&#10;```code```"
                            />
                          ) : (
                            <div className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-3 text-sm bg-gray-50 dark:bg-gray-800 overflow-y-auto" style={{ minHeight: '300px', maxHeight: '400px' }}>
                              {formData.content ? (
                                <MarkdownRenderer content={formData.content} />
                              ) : (
                                <p className="text-gray-500 dark:text-gray-400 italic">
                                  No content to preview. Switch to Edit tab to add content.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expandable Sections - Only show when expanded */}
                        {expandedSections.tags && (
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              {t('forms.tags')}
                            </h3>
                            <TagInput
                              onTagsChange={handleTagsChange}
                              initialTags={tags}
                              availableTags={availableTags}
                            />
                          </div>
                        )}

                        {expandedSections.project && (
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              {t('forms.task.labels.project', 'Project')}
                            </h3>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={t('forms.task.projectSearchPlaceholder', 'Search or create a project...')}
                                value={newProjectName}
                                onChange={handleProjectSearch}
                                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                              />
                              {dropdownOpen && newProjectName && (
                                <div className="absolute mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md w-full z-50 border border-gray-200 dark:border-gray-700">
                                  {filteredProjects.length > 0 && (
                                    filteredProjects.map((project) => (
                                      <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => handleProjectSelection(project)}
                                        className="block w-full text-gray-700 dark:text-gray-300 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      >
                                        {project.name}
                                      </button>
                                    ))
                                  )}
                                  {filteredProjects.length === 0 && (
                                    <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                      {t('forms.task.noMatchingProjects', 'No matching projects')}
                                    </div>
                                  )}
                                  {newProjectName.trim() && onCreateProject && (
                                    <button
                                      type="button"
                                      onClick={handleCreateProject}
                                      disabled={isCreatingProject}
                                      className="block w-full text-left px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                    >
                                      {isCreatingProject
                                        ? t('forms.task.creatingProject', 'Creating...')
                                        : t('forms.task.createProject', '+ Create') + ` "${newProjectName.trim()}"`}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {error && <div className="text-red-500 px-4 mb-4">{error}</div>}
                      </fieldset>
                    </form>
                  </div>
                </div>
                
                {/* Section Icons - Above border, split layout */}
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 px-3 py-2">
                  <div className="flex items-center justify-between">
                    {/* Left side: Section icons */}
                    <div className="flex items-center space-x-1">
                      {/* Tags Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleSection('tags')}
                        className={`relative p-2 rounded-full transition-colors ${
                          expandedSections.tags
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={t('forms.tags', 'Tags')}
                      >
                        <TagIcon className="h-5 w-5" />
                        {formData.tags && formData.tags.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                        )}
                      </button>
                      
                      {/* Project Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleSection('project')}
                        className={`relative p-2 rounded-full transition-colors ${
                          expandedSections.project
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={t('forms.task.labels.project', 'Project')}
                      >
                        <FolderIcon className="h-5 w-5" />
                        {formData.project && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons - Below border with custom layout */}
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
                  {/* Left side: Delete and Cancel */}
                  <div className="flex items-center space-x-3">
                    {formData.id && formData.id !== 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteNote}
                        className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                        title={t('common.delete', 'Delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                  
                  {/* Right side: Save */}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting
                      ? t('modals.submitting')
                      : formData.id && formData.id !== 0
                      ? t('modals.updateNote')
                      : t('modals.createNote')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NoteModal;