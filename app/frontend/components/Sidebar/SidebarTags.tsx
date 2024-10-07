// src/components/Sidebar/SidebarTags.tsx

import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { TagIcon, PlusCircleIcon } from '@heroicons/react/24/outline'; // Using outline style

interface Tag {
  id: number;
  name: string;
  active: boolean;
}

interface SidebarTagsProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
}

const SidebarTags: React.FC<SidebarTagsProps> = ({
  handleNavClick,
  location,
  isDarkMode,
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags?active=true'); // Fetch only active tags
        const data = await response.json();
        if (response.ok) {
          setTags(data.tags || []);
        } else {
          console.error('Failed to fetch tags:', data.error);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  const startTagCreation = () => {
    setIsCreatingTag(true);
  };

  const handleTagNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTagName(e.target.value);
  };

  const handleTagCreation = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTagName.trim()) {
      try {
        const response = await fetch('/api/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newTagName }),
        });

        if (response.ok) {
          const newTag = await response.json();
          setTags((prevTags) => [...prevTags, newTag]);
          setNewTagName('');
          setIsCreatingTag(false);
        } else {
          console.error('Failed to create tag');
        }
      } catch (error) {
        console.error('Error creating tag:', error);
      }
    }
  };

  const isActiveTag = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        {/* "TAGS" Title with Add Button */}
        <li
          className={`flex justify-between items-center px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveTag(
            '/tags'
          )}`}
          onClick={() => handleNavClick('/tags', 'Tags', 'tag')}
        >
          <span className="flex items-center">
            <TagIcon className="h-5 w-5 mr-2" />
            TAGS
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startTagCreation();
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Tag"
            title="Add Tag"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>

        {/* Input for New Tag Creation */}
        {isCreatingTag && (
          <li className="px-4 py-1">
            <input
              type="text"
              value={newTagName}
              onChange={handleTagNameChange}
              onKeyDown={handleTagCreation}
              placeholder="New tag name"
              autoFocus
              className="w-full px-2 py-1 text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </li>
        )}

        {/* List of Tags */}
        {tags.map((tag) => (
          <li key={tag.id}>
            <button
              onClick={() =>
                handleNavClick(`/tag/${tag.id}`, tag.name, 'tag')
              }
              className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActiveTag(
                `/tag/${tag.id}`
              )}`}
            >
              <TagIcon className="h-5 w-5 mr-2 text-blue-500" />
              {tag.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default SidebarTags;
