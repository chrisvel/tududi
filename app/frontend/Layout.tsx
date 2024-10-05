import React, { useState } from 'react';
import Sidebar from './Sidebar';
import './styles/tailwind.css';
import ProjectModal from './components/Project/ProjectModal';
import NoteModal from './components/Note/NoteModal';
import AreaModal from './components/Area/AreaModal';
import TagModal from './components/Tag/TagModal';
import { Note } from './entities/Note';
import { Area } from './entities/Area';
import { Tag } from './entities/Tag';
import { useDataContext } from './contexts/DataContext';  // Import the data context

interface LayoutProps {
  currentUser: {
    email: string;
  };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  currentUser,
  isDarkMode,
  toggleDarkMode,
  children,
}) => {
  // State for modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  // State for selected entities
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Use context to fetch data
  const {
    tags,
    areas,
    notes,
    isLoading,
    isError,
    createNote,
    updateNote,
    deleteNote,
    createArea,
    updateArea,
    deleteArea,
    createTag,
    updateTag,
    deleteTag,
    createProject,
    updateProject,
    deleteProject
  } = useDataContext(); // Now includes project management functions

  // Handler functions for modals
  const openNoteModal = (note: Note | null = null) => {
    setSelectedNote(note);
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setIsNoteModalOpen(false);
    setSelectedNote(null);
  };

  const openProjectModal = () => {
    setIsProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setIsProjectModalOpen(false);
  };

  const openAreaModal = (area: Area | null = null) => {
    setSelectedArea(area);
    setIsAreaModalOpen(true);
  };

  const closeAreaModal = () => {
    setIsAreaModalOpen(false);
    setSelectedArea(null);
  };

  const openTagModal = (tag: Tag | null = null) => {
    setSelectedTag(tag);
    setIsTagModalOpen(true);
  };

  const closeTagModal = () => {
    setIsTagModalOpen(false);
    setSelectedTag(null);
  };

  // Handler for saving notes
  const handleSaveNote = async (noteData: Note) => {
    try {
      if (noteData.id) {
        // Update existing note
        await updateNote(noteData.id, {
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags?.map((tag) => tag.name),
          project_id: noteData.project?.id,
        });
      } else {
        // Create new note
        await createNote({
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags?.map((tag) => tag.name),
          project_id: noteData.project?.id,
        });
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
    closeNoteModal();
  };

  // Handler for saving projects
  const handleSaveProject = async (projectData: Project) => {
    try {
      if (projectData.id) {
        await updateProject(projectData.id, projectData);
      } else {
        await createProject(projectData);
      }
    } catch (error) {
      console.error('Error saving project:', error);
    }
    closeProjectModal();
  };

  // Handler for saving areas
  const handleSaveArea = async (areaData: Area) => {
    try {
      if (areaData.id) {
        await updateArea(areaData.id, areaData);
      } else {
        await createArea(areaData);
      }
    } catch (error) {
      console.error('Error saving area:', error);
    }
    closeAreaModal();
  };

  // Handler for saving tags
  const handleSaveTag = async (tagData: Tag) => {
    try {
      if (tagData.id) {
        await updateTag(tagData.id, tagData);
      } else {
        await createTag(tagData);
      }
    } catch (error) {
      console.error('Error saving tag:', error);
    }
    closeTagModal();
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
        <Sidebar
          currentUser={currentUser}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          openProjectModal={openProjectModal}
          openNoteModal={openNoteModal}
          openAreaModal={openAreaModal}
          openTagModal={openTagModal}
          notes={notes}
          areas={areas}
          tags={tags}
        />
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-xl text-gray-700 dark:text-gray-200">Loading...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
        <Sidebar
          currentUser={currentUser}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          openProjectModal={openProjectModal}
          openNoteModal={openNoteModal}
          openAreaModal={openAreaModal}
          openTagModal={openTagModal}
          notes={notes}
          areas={areas}
          tags={tags}
        />
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-xl text-red-500">Error fetching data.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        openProjectModal={openProjectModal}
        openNoteModal={openNoteModal}
        openAreaModal={openAreaModal}
        openTagModal={openTagModal}
        notes={notes}
        areas={areas}
        tags={tags}
      />
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 overflow-y-auto h-screen">
        <div className="flex-grow p-6 pt-20 overflow-y-auto">
          <div className="w-full max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </div>

      {isProjectModalOpen && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={closeProjectModal}
          onSave={handleSaveProject}
          areas={areas}
        />
      )}

      {isNoteModalOpen && (
        <NoteModal
          isOpen={isNoteModalOpen}
          onClose={closeNoteModal}
          onSave={handleSaveNote}
          note={selectedNote}
        />
      )}

      {isAreaModalOpen && (
        <AreaModal
          isOpen={isAreaModalOpen}
          onClose={closeAreaModal}
          onSave={handleSaveArea}
          area={selectedArea}
        />
      )}

      {isTagModalOpen && (
        <TagModal
          isOpen={isTagModalOpen}
          onClose={closeTagModal}
          onSave={handleSaveTag}
          tag={selectedTag}
        />
      )}
    </div>
  );
};

export default Layout;
