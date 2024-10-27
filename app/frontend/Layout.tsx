import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import "./styles/tailwind.css";
import ProjectModal from "./components/Project/ProjectModal";
import NoteModal from "./components/Note/NoteModal";
import AreaModal from "./components/Area/AreaModal";
import TagModal from "./components/Tag/TagModal";
import { Note } from "./entities/Note";
import { Area } from "./entities/Area";
import { Tag } from "./entities/Tag";
import { Project } from "./entities/Project";
import { useDataContext } from "./contexts/DataContext";

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
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

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
    deleteProject,
  } = useDataContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(
    window.innerWidth >= 1024
  );

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const handleSaveNote = async (noteData: Note) => {
    try {
      if (noteData.id) {
        await updateNote(noteData.id, {
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags?.map((tag) => tag.name),
          project_id: noteData.project?.id,
        });
      } else {
        await createNote({
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags?.map((tag) => tag.name),
          project_id: noteData.project?.id,
        });
      }
    } catch (error) {
      console.error("Error saving note:", error);
    }
    closeNoteModal();
  };

  const handleSaveProject = async (projectData: Project) => {
    try {
      if (projectData.id) {
        await updateProject(projectData.id, projectData);
      } else {
        await createProject(projectData);
      }
    } catch (error) {
      console.error("Error saving project:", error);
    }
    closeProjectModal();
  };

  const handleSaveArea = async (areaData: Area) => {
    try {
      if (areaData.id) {
        await updateArea(areaData.id, areaData);
      } else {
        await createArea(areaData);
      }
    } catch (error) {
      console.error("Error saving area:", error);
    }
    closeAreaModal();
  };

  const handleSaveTag = async (tagData: Tag) => {
    try {
      if (tagData.id) {
        await updateTag(tagData.id, tagData);
      } else {
        await createTag(tagData);
      }
    } catch (error) {
      console.error("Error saving tag:", error);
    }
    closeTagModal();
  };

  const mainContentMarginLeft = isSidebarOpen ? "ml-64" : "ml-16";

  if (isLoading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
        {/* Navbar */}
        <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} currentUser={currentUser} />

        {/* Sidebar */}
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
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

        {/* Main Content */}
        <div
          className={`flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800 transition-all duration-300 ease-in-out ${mainContentMarginLeft}`}
        >
          <div className="text-xl text-gray-700 dark:text-gray-200">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
        {/* Navbar */}
        <Navbar
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          currentUser={currentUser}
        />

        {/* Sidebar */}
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
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

        {/* Main Content */}
        <div
          className={`flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 transition-all duration-300 ease-in-out ${mainContentMarginLeft}`}
        >
          <div className="text-xl text-red-500">Error fetching data.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
      {/* Navbar */}
      <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} currentUser={currentUser}/>

      {/* Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
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

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ease-in-out ${mainContentMarginLeft}`}
      >
        <div className="flex flex-col bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-screen overflow-y-auto">
          <div className="flex-grow p-6 pt-24">
            <div className="w-full max-w-5xl mx-auto">{children}</div>
          </div>
        </div>
      </div>

      {/* Modals */}
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
