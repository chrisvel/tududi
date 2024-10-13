// src/components/Layout.tsx

import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import './styles/tailwind.css';
import { Project } from './entities/Project';
import { Area } from './entities/Area';
import { Tag } from './entities/Tag';
import ProjectModal from './components/Project/ProjectModal';
import NoteModal from './components/Note/NoteModal';
import AreaModal from './components/Area/AreaModal';
import TagModal from './components/Tag/TagModal';
import { Note } from './entities/Note';

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
  
  const [areas, setAreas] = useState<Area[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Fetch tags when the component mounts
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });
        const data = await response.json();

        if (response.ok) {
          setTags(data || []);
        } else {
          console.error('Failed to fetch tags:', data.error);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };

    fetchTags();
  }, []);

  // Fetch areas when the component mounts
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });
        const data = await response.json();

        if (response.ok) {
          setAreas(data || []);
        } else {
          console.error('Failed to fetch areas:', data.error);
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
        const response = await fetch('/api/notes', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });
        const data = await response.json();

        if (response.ok) {
          setNotes(data || []);
        } else {
          console.error('Failed to fetch notes:', data.error);
        }
      } catch (error) {
        console.error('Error fetching notes:', error);
      }
    };
    fetchNotes();
  }, []);

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

  const handleSaveNote = async (noteData: Note) => {
    const notePayload = {
      title: noteData.title,
      content: noteData.content,
      tags: noteData.tags?.map((tag) => tag.name),
      project_id: noteData.project?.id,
    };

    if (noteData.id) {
      // Update existing note
      try {
        const response = await fetch(`/api/notes/${noteData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
          console.error('Failed to update note:', errorData.error);
        }
      } catch (error) {
        console.error('Error updating note:', error);
      }
    } else {
      // Create new note
      try {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(notePayload),
        });

        if (response.ok) {
          const newNote = await response.json();
          setNotes((prevNotes) => [...prevNotes, newNote]);
        } else {
          const errorData = await response.json();
          console.error('Failed to create note:', errorData.error);
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
        openNoteModal={openNoteModal}
        openAreaModal={openAreaModal}
        openTagModal={openTagModal}
        notes={notes}
        areas={areas}
        tags={tags}
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

      {/* Modals */}
      {isProjectModalOpen && (
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={closeProjectModal}
          onSave={() => {}}
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
          onSave={() => {}}
          area={selectedArea}
        />
      )}

      {isTagModalOpen && (
        <TagModal
          isOpen={isTagModalOpen}
          onClose={closeTagModal}
          onSave={() => {}}
          tag={selectedTag}
        />
      )}
    </div>
  );
};

export default Layout;
