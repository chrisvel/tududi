import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  TagIcon, 
  CheckIcon, 
  BookOpenIcon, 
  FolderIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/solid';
import { Task } from '../../entities/Task';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import TaskList from '../Task/TaskList';
import ProjectItem from '../Project/ProjectItem';

interface Tag {
  id: number;
  name: string;
  active: boolean;
}

const TagDetails: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for ProjectItem components
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<number | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const navigate = useNavigate(); 

  useEffect(() => {
    const fetchTagData = async () => {
      try {
        // First fetch tag details
        const tagResponse = await fetch(`/api/tag/${id}`);
        if (tagResponse.ok) {
          const tagData = await tagResponse.json();
          setTag(tagData);
          
          // Now fetch entities that have this tag using the tag name
          const [tasksResponse, notesResponse, projectsResponse] = await Promise.all([
            fetch(`/api/tasks?tag=${encodeURIComponent(tagData.name)}`),
            fetch(`/api/notes?tag=${encodeURIComponent(tagData.name)}`),
            fetch(`/api/projects`) // Projects API doesn't support tag filtering yet
          ]);

          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            setTasks(tasksData.tasks || []);
          }

          if (notesResponse.ok) {
            const notesData = await notesResponse.json();
            setNotes(notesData || []);
          }

          if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json();
            // Filter projects client-side since API doesn't support tag filtering
            const allProjects = projectsData.projects || projectsData || [];
            const filteredProjects = allProjects.filter((project: any) => 
              project.tags && project.tags.some((tag: any) => tag.name === tagData.name)
            );
            setProjects(filteredProjects);
          }
        } else {
          const tagError = await tagResponse.json();
          setError(tagError.error || 'Failed to fetch tag.');
        }
      } catch (err) {
        setError(t('tags.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchTagData();
  }, [id, t]);

  // Task handlers
  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const response = await fetch(`/api/task/${updatedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTask),
      });

      if (response.ok) {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === updatedTask.id ? updatedTask : task
          )
        );
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const response = await fetch(`/api/task/${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Project handlers  
  const handleEditProject = (project: Project) => {
    // For now, just log - could add modal later
    console.log("Edit project:", project);
  };


  const getCompletionPercentage = (project: Project) => {
    return (project as any).completion_percentage || 0;
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "low":
        return { color: "bg-green-500" };
      case "medium":
        return { color: "bg-yellow-500" };
      case "high":
        return { color: "bg-red-500" };
      default:
        return { color: "bg-gray-500" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          {t('tags.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!tag) {
    return <div className="text-gray-700 dark:text-gray-300 p-4">{t('tags.notFound')}</div>;
  }

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        {/* Tag Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <TagIcon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">
              {tag.name}
            </h2>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm ${
            tag.active 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          }`}>
            {tag.active ? t('tags.active') : t('tags.inactive')}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <div className="flex items-center">
              <CheckIcon className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{tasks.length}</p>
                <p className="text-gray-600 dark:text-gray-400">{t('tasks.title')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <div className="flex items-center">
              <BookOpenIcon className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{notes.length}</p>
                <p className="text-gray-600 dark:text-gray-400">{t('notes.title')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <div className="flex items-center">
              <FolderIcon className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{projects.length}</p>
                <p className="text-gray-600 dark:text-gray-400">{t('projects.title')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        {tasks.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <CheckIcon className="h-5 w-5 mr-2" />
              {t('tasks.title')} ({tasks.length})
            </h3>
            <TaskList
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              projects={[]} // Empty since we're viewing by tag
              hideProjectName={false}
            />
          </div>
        )}

        {/* Notes Section */}
        {notes.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <BookOpenIcon className="h-5 w-5 mr-2" />
              {t('notes.title')} ({notes.length})
            </h3>
            <ul className="space-y-1">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-3 flex justify-between items-center"
                  onMouseEnter={() => setHoveredNoteId(note.id || null)}
                  onMouseLeave={() => setHoveredNoteId(null)}
                >
                  <div className="flex-grow overflow-hidden pr-4">
                    <div className="flex items-center flex-wrap gap-2">
                      <Link
                        to={`/note/${note.id}`}
                        className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                      >
                        {note.title}
                      </Link>
                      {/* Tags */}
                      {((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0)) && (
                        <>
                          {(note.tags || note.Tags || []).map((noteTag) => (
                            <button
                              key={noteTag.id}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/tag/${noteTag.id}`);
                              }}
                              className="flex items-center space-x-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              <TagIcon className="h-3 w-3 text-gray-500 dark:text-gray-300" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {noteTag.name}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => console.log("Edit note:", note)}
                      className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${hoveredNoteId === note.id ? 'opacity-100' : 'opacity-0'}`}
                      aria-label={`Edit ${note.title}`}
                      title={`Edit ${note.title}`}
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => console.log("Delete note:", note)}
                      className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${hoveredNoteId === note.id ? 'opacity-100' : 'opacity-0'}`}
                      aria-label={`Delete ${note.title}`}
                      title={`Delete ${note.title}`}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Projects Section */}
        {projects.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <FolderIcon className="h-5 w-5 mr-2" />
              {t('projects.title')} ({projects.length})
            </h3>
            <div className="flex flex-col space-y-1">
              {projects.map((project) => {
                const { color } = getPriorityStyles(project.priority || "low");
                return (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    viewMode="list"
                    color={color}
                    getCompletionPercentage={() => getCompletionPercentage(project)}
                    activeDropdown={activeDropdown}
                    setActiveDropdown={setActiveDropdown}
                    handleEditProject={handleEditProject}
                    setProjectToDelete={setProjectToDelete}
                    setIsConfirmDialogOpen={setIsConfirmDialogOpen}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && notes.length === 0 && projects.length === 0 && (
          <div className="text-center py-8">
            <TagIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {t('tags.noItemsWithTag', `No items found with the tag "${tag.name}"`)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagDetails;
