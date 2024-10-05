import React, { useState, useEffect } from 'react';

interface TagInputProps {
  initialTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[]; // Available tags to preload
}

const TagInput: React.FC<TagInputProps> = ({ initialTags, onTagsChange, availableTags }) => {
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>(initialTags || []); // Ensure tags is always an array

  useEffect(() => {
    onTagsChange(tags);
  }, [tags, onTagsChange]);

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  // Handle key press (Enter) to add the tag
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault(); // Prevent form submission
      if (!tags.includes(inputValue.trim())) {
        setTags([...tags, inputValue.trim()]); // Add the tag
      }
      setInputValue(''); // Clear the input
    }
  };

  // Handle removing a tag
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span key={index} className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
            {tag}
            <button
              type="button"
              className="ml-2 text-red-500"
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
        className="w-full border px-3 py-2 rounded-md shadow-sm"
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
