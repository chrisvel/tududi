import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { BookOpenIcon, PlusCircleIcon } from '@heroicons/react/24/solid';

interface Note {
  id: number;
  title: string;
  // Add other note properties if needed
}

interface SidebarNotesProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
}

const SidebarNotes: React.FC<SidebarNotesProps> = ({
  handleNavClick,
  location,
  isDarkMode,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');

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

  const handleNoteCreation = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newNoteTitle.trim()) {
      try {
        const response = await fetch('/api/note/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newNoteTitle }),
        });

        if (response.ok) {
          const newNote = await response.json();
          setNotes((prevNotes) => [...prevNotes, newNote]);
          setNewNoteTitle('');
          setIsCreatingNote(false);
        } else {
          console.error('Failed to create note');
        }
      } catch (error) {
        console.error('Error creating note:', error);
      }
    }
  };

  const isActiveNote = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        {/* "NOTES" Title with Add Button */}
        <li
          className={`flex justify-between items-center px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveNote(
            '/notes'
          )}`}
          onClick={() => handleNavClick('/notes', 'Notes', 'book')}
        >
          <span className="flex items-center">
            <BookOpenIcon className="h-5 w-5 mr-2" /> {/* Replace with BookOpenIcon */}
            NOTES
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCreatingNote(true);
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Note"
            title="Add Note"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>

        {/* Input for New Note Creation */}
        {isCreatingNote && (
          <li className="px-4 py-1">
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              onKeyDown={handleNoteCreation}
              placeholder="New note title"
              autoFocus
              className="w-full px-2 py-1 text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </li>
        )}

        {/* List of Notes */}
        {notes.map((note) => (
          <li key={note.id}>
            <button
              onClick={() => handleNavClick(`/note/${note.id}`, note.title, 'book')}
              className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActiveNote(
                `/note/${note.id}`
              )}`}
            >
              <BookOpenIcon className="h-5 w-5 mr-2 text-blue-500" /> {/* Replace with BookOpenIcon */}
              {note.title}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default SidebarNotes;
