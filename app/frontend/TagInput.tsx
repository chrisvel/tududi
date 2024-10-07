// src/TagInput.tsx

import React, { useState } from 'react';

interface TagInputProps {
  initialTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[]; // Available tags to preload
}

const TagInput: React.FC<TagInputProps> = ({ initialTags, onTagsChange, availableTags = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>(initialTags || []);

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  // Handle key press (Enter) to add the tag
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault(); // Prevent form submission
      const trimmedValue = inputValue.trim();
      if (!tags.includes(trimmedValue)) {
        const updatedTags = [...tags, trimmedValue];
        setTags(updatedTags); // Update internal state
        onTagsChange(updatedTags); // Notify parent
      }
      setInputValue(''); // Clear the input
    }
  };

  // Handle removing a tag
  const removeTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags); // Update internal state
    onTagsChange(updatedTags); // Notify parent
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full flex items-center"
          >
            {tag}
            <button
              type="button"
              className="ml-2 text-red-500 focus:outline-none"
              onClick={() => removeTag(tag)}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyPress}
        list="available-tags" // Datalist for suggestions
        placeholder="Add a tag"
        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      />
      <datalist id="available-tags">
        {availableTags.map((tag, index) => (
          <option key={index} value={tag} />
        ))}
      </datalist>
    </div>
  );
};

export default TagInput;
