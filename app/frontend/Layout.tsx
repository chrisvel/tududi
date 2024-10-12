import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import './styles/tailwind.css';
import { Project } from './entities/Project';
import { Area } from './entities/Area';
import ProjectModal from './components/Project/ProjectModal';
import NoteModal from './components/Note/NoteModal'; // Import NoteModal
import { Note } from './entities/Note'; // Import Note type

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
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false); // NoteModal state
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null); // For editing notes
  const [notes, setNotes] = useState<Note[]>([]); // Notes state

  // Fetch areas when the component mounts
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas');
        const data = await response.json();

        if (response.ok) {
          setAreas(data);
        } else {
          console.error('Failed to fetch areas');
        }
      } catch (error) {
        console.error('Error fetching areas:', error);
      }
    };

    fetchAreas();
  }, []);

  // Fetch notes when the component mounts
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes');
        const data = await response.json();

        if (response.ok) {
          setNotes(data.notes || []);
        } else {
          console.error('Failed to fetch notes:', data.error);
        }
      } catch (error) {
        console.error('Error fetching notes:', error);
      }
    };
    fetchNotes();
  }, []);

  const openProjectModal = () => {
    setIsProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setIsProjectModalOpen(false);
  };

  // Functions for NoteModal
  const openNoteModal = (note: Note | null = null) => {
    setSelectedNote(note);
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setIsNoteModalOpen(false);
    setSelectedNote(null);
  };

  const handleSaveProject = async (project: Project) => {
    // Code to save project
  };

  const handleSaveNote = async (noteData: Note) => {
    const notePayload = {
      title: noteData.title,
      content: noteData.content,
      tags: JSON.stringify(noteData.tags.map((tag) => ({ value: tag.name }))),
    };
  
    if (noteData.id) {
      // Update existing note
      try {
        const response = await fetch(`/api/note/${noteData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(notePayload),
        });
  
        if (response.ok) {
          const updatedNote = await response.json();
          setNotes((prevNotes) =>
            prevNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note))
          );
        } else {
          const errorData = await response.json();
          console.error('Failed to update note:', errorData);
        }
      } catch (error) {
        console.error('Error updating note:', error);
      }
    } else {
      // Create new note
      try {
        const response = await fetch('/api/note', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(notePayload),
        });
  
        if (response.ok) {
          const newNote = await response.json();
          setNotes((prevNotes) => [...prevNotes, newNote]);
        } else {
          const errorData = await response.json();
          console.error('Failed to create note:', errorData);
        }
      } catch (error) {
        console.error('Error creating note:', error);
      }
    }
  
    closeNoteModal();
  };  

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        openProjectModal={openProjectModal}
        openNoteModal={openNoteModal} // Pass down the function
        notes={notes} // Pass notes to SidebarNotes
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 overflow-y-auto h-screen">
        {/* Content wrapper */}
        <div className="flex-grow p-6 pt-20 overflow-y-auto">
          <div className="w-full max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </div>

      {/* ProjectModal */}
      {isProjectModalOpen && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={closeProjectModal}
          onSave={handleSaveProject}
          areas={areas}
        />
      )}

      {/* NoteModal */}
      {isNoteModalOpen && (
        <NoteModal
          isOpen={isNoteModalOpen}
          onClose={closeNoteModal}
          onSave={handleSaveNote}
          note={selectedNote}
        />
      )}
    </div>
  );
};

export default Layout;
