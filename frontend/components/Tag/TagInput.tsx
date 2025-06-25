import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '../../entities/Tag';
import { useTranslation } from 'react-i18next';

interface TagInputProps {
  initialTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: Tag[];
}

const TagInput: React.FC<TagInputProps> = ({ initialTags, onTagsChange, availableTags }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>(initialTags || []);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update internal tags state when initialTags prop changes
  useEffect(() => {    
    // Set the tags state with the initial tags
    if (initialTags && initialTags.length > 0) {
      // Simply set our internal state to match the initialTags
      setTags(initialTags);
    }
  }, [initialTags]);
  
  // Remove this effect to prevent infinite loops
  // onTagsChange is called directly in addNewTag, selectTag, and removeTag

  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue.trim() === '') {
        setFilteredTags([]);
        setIsDropdownOpen(false);
        return;
      }

      const filtered = availableTags.filter(tag =>
        tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(tag.name)
      );
      setFilteredTags(filtered);
      setIsDropdownOpen(filtered.length > 0);
      setHighlightedIndex(-1);
    }, 300); 

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, availableTags, tags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex(prev => (prev < filteredTags.length - 1 ? prev + 1 : prev));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredTags.length) {
        selectTag(filteredTags[highlightedIndex].name);
      } else if (inputValue.trim()) {
        addNewTag(inputValue.trim());
      }
    } else if (event.key === 'Escape') {
      setIsDropdownOpen(false);
    } else if (event.key === ',') {
      if (inputValue.trim()) {
        event.preventDefault();
        addNewTag(inputValue.trim());
      }
    }
  };

  const addNewTag = (tag: string) => {
    if (tags.length >= 10) { 
      return;
    }

    if (!tags.includes(tag)) {
      const updatedTags = [...tags, tag];
      setTags(updatedTags);
      onTagsChange(updatedTags);
    }
    setInputValue('');
    setIsDropdownOpen(false);
  };

  const selectTag = (tag: string) => {
    if (!tags.includes(tag)) {
      const updatedTags = [...tags, tag];
      setTags(updatedTags);
      onTagsChange(updatedTags);
    }
    setInputValue('');
    setIsDropdownOpen(false);
  };

  const removeTag = (index: number) => {
    const updatedTags = tags.filter((_, i) => i !== index);
    setTags(updatedTags);
    onTagsChange(updatedTags);
  };

  return (
    <div className="space-y-2 relative">
      <div
        ref={containerRef}
        className="flex flex-wrap items-center border border-gray-300 dark:border-gray-900 bg-white dark:bg-gray-900 rounded-md p-2 min-h-[40px]"
      >
        {tags.length > 0 ? (
          tags.map((tag, index) => (
            <span
              key={index}
              className="flex items-center bg-gray-200 text-gray-700 text-xs font-medium mr-2 px-2.5 py-0.5 rounded"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-1 text-gray-600 hover:text-gray-800 focus:outline-none"
                aria-label={`Remove tag ${tag}`}
              >
                &times;
              </button>
            </span>
          ))
        ) : (
          <span className="text-gray-400 text-xs"></span>
        )}

        <input
          type="text"
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t('tags.typeToAdd')}
          className="flex-grow bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100"
          onFocus={() => {
            if (filteredTags.length > 0) setIsDropdownOpen(true);
          }}
          style={{ minWidth: '150px' }}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          aria-controls="tag-suggestions"
        />
      </div>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
          id="tag-suggestions"
        >
          {filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => selectTag(tag.name)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${
                highlightedIndex === index ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseLeave={() => setHighlightedIndex(-1)}
              role="option"
              aria-selected={highlightedIndex === index}
            >
              {highlightedIndex === index ? (
                <>
                  {inputValue.length > 0 && (
                    <span className="font-semibold">
                      {tag.name.substring(0, inputValue.length)}
                    </span>
                  )}
                  {tag.name.substring(inputValue.length)}
                </>
              ) : (
                tag.name
              )}
            </button>
          ))}
          {/* Option to add a new tag if no matches */}
          {filteredTags.length === 0 && inputValue.trim() !== '' && (
            <button
              type="button"
              onClick={() => addNewTag(inputValue.trim())}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              role="option"
            >
              + Create "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
