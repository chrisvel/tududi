import React, { useState, useEffect, useRef, useCallback } from "react";
import { Task } from "../../entities/Task";
import { Tag } from "../../entities/Tag";
import { useToast } from "../Shared/ToastContext";
import { useTranslation } from "react-i18next";
import { createInboxItemWithStore } from "../../utils/inboxService";
import { isAuthError } from "../../utils/authUtils";
import { createTag } from "../../utils/tagsService";
import { XMarkIcon, TagIcon } from "@heroicons/react/24/outline";
import { useModalEvents } from "../../hooks/useModalEvents";
import { useStore } from "../../store/useStore";
import { Link } from "react-router-dom";
// import UrlPreview from "../Shared/UrlPreview";
// import { UrlTitleResult } from "../../utils/urlService";

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => Promise<void>;
  initialText?: string;
  editMode?: boolean;
  onEdit?: (text: string) => Promise<void>;
}

const InboxModal: React.FC<InboxModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialText = "",
  editMode = false,
  onEdit,
}) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState<string>(initialText);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [saveMode, setSaveMode] = useState<'task' | 'inbox'>('inbox');
  const { tagsStore: { tags, setTags } } = useStore();
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentHashtagQuery, setCurrentHashtagQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ left: 0, top: 0 });
  // const [urlPreview, setUrlPreview] = useState<UrlTitleResult | null>(null);

  // Dispatch global modal events to hide floating + button
  useModalEvents(isOpen);

  // Helper function to parse hashtags from text
  const parseHashtags = (text: string): string[] => {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  };

  // Helper function to get current hashtag query at cursor position
  const getCurrentHashtagQuery = (text: string, position: number): string => {
    const beforeCursor = text.substring(0, position);
    const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);
    return hashtagMatch ? hashtagMatch[1] : '';
  };

  // Helper function to render text with clickable hashtags
  const renderTextWithHashtags = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        const tagName = part.substring(1);
        const tag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (tag) {
          return (
            <Link
              key={index}
              to={`/tag/${tag.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Helper function to calculate dropdown position based on cursor
  const calculateDropdownPosition = (input: HTMLInputElement, cursorPos: number) => {
    // Create a temporary element to measure text width
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.fontSize = getComputedStyle(input).fontSize;
    temp.style.fontFamily = getComputedStyle(input).fontFamily;
    temp.style.fontWeight = getComputedStyle(input).fontWeight;
    temp.textContent = inputText.substring(0, cursorPos);
    
    document.body.appendChild(temp);
    const textWidth = temp.getBoundingClientRect().width;
    document.body.removeChild(temp);
    
    // Get the # position for the current hashtag
    const beforeCursor = inputText.substring(0, cursorPos);
    const hashtagMatch = beforeCursor.match(/#[a-zA-Z0-9_]*$/);
    
    if (hashtagMatch) {
      const hashtagStart = beforeCursor.lastIndexOf('#');
      
      // Create temp element for text up to hashtag start
      const tempToHashtag = document.createElement('span');
      tempToHashtag.style.visibility = 'hidden';
      tempToHashtag.style.position = 'absolute';
      tempToHashtag.style.fontSize = getComputedStyle(input).fontSize;
      tempToHashtag.style.fontFamily = getComputedStyle(input).fontFamily;
      tempToHashtag.style.fontWeight = getComputedStyle(input).fontWeight;
      tempToHashtag.textContent = inputText.substring(0, hashtagStart);
      
      document.body.appendChild(tempToHashtag);
      const hashtagOffset = tempToHashtag.getBoundingClientRect().width;
      document.body.removeChild(tempToHashtag);
      
      return {
        left: hashtagOffset,
        top: input.offsetHeight
      };
    }
    
    return { left: textWidth, top: input.offsetHeight };
  };

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;
    
    setInputText(newText);
    setCursorPosition(newCursorPosition);
    
    // Check if user is typing a hashtag
    const hashtagQuery = getCurrentHashtagQuery(newText, newCursorPosition);
    setCurrentHashtagQuery(hashtagQuery);
    
    if (newText.charAt(newCursorPosition - 1) === '#' || hashtagQuery) {
      // Filter tags based on current query
      const filtered = tags.filter(tag => 
        tag.name.toLowerCase().startsWith(hashtagQuery.toLowerCase())
      ).slice(0, 5); // Limit to 5 suggestions
      
      // Calculate dropdown position
      const position = calculateDropdownPosition(e.target, newCursorPosition);
      setDropdownPosition(position);
      
      setFilteredTags(filtered);
      setShowTagSuggestions(true);
    } else {
      setShowTagSuggestions(false);
      setFilteredTags([]);
    }
  };

  // Handle tag suggestion selection
  const handleTagSelect = (tagName: string) => {
    const beforeCursor = inputText.substring(0, cursorPosition);
    const afterCursor = inputText.substring(cursorPosition);
    const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);
    
    if (hashtagMatch) {
      const newText = beforeCursor.replace(/#([a-zA-Z0-9_]*)$/, `#${tagName}`) + afterCursor;
      setInputText(newText);
      setShowTagSuggestions(false);
      setFilteredTags([]);
      
      // Focus back on input and set cursor position
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
          const newCursorPos = beforeCursor.replace(/#([a-zA-Z0-9_]*)$/, `#${tagName}`).length;
          nameInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Create missing tags automatically
  const createMissingTags = async (text: string): Promise<void> => {
    const hashtagsInText = parseHashtags(text);
    const existingTagNames = tags.map(tag => tag.name.toLowerCase());
    const missingTags = hashtagsInText.filter(tagName => 
      !existingTagNames.includes(tagName.toLowerCase())
    );

    for (const tagName of missingTags) {
      try {
        const newTag = await createTag({ name: tagName });
        // Update the global tags store
        setTags([...tags, newTag]);
      } catch (error) {
        console.error(`Failed to create tag "${tagName}":`, error);
        // Don't fail the entire operation if tag creation fails
      }
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!inputText.trim() || isSaving) return;
    
    setIsSaving(true);
    
    try {
      // Create missing tags first
      await createMissingTags(inputText.trim());
      
      if (editMode && onEdit) {
        await onEdit(inputText.trim());
        setIsClosing(true);
        setTimeout(() => {
          onClose();
          setIsClosing(false);
        }, 300);
        return; // Exit early to prevent creating duplicates
      }
      
      if (saveMode === 'task') {
        const newTask: Task = {
          name: inputText.trim(),
          status: "not_started",
        };
        
        try {
          await onSave(newTask);
          showSuccessToast(t('task.createSuccess'));
          setInputText('');
          handleClose();
        } catch (error: any) {
          // If it's an auth error, don't show error toast (user will be redirected)
          if (isAuthError(error)) {
            return;
          }
          throw error;
        }
      } else {
        try {
          await createInboxItemWithStore(inputText.trim());
          
          showSuccessToast(t('inbox.itemAdded'));
          
          handleClose();
        } catch (error) {
          console.error('Failed to create inbox item:', error);
          showErrorToast(t('inbox.addError'));
          setIsSaving(false);
        }
      }
    } catch (error) {
      console.error('Failed to save:', error);
      if (editMode) {
        showErrorToast(t('inbox.updateError'));
      } else {
        showErrorToast(saveMode === 'task' ? t('task.createError') : t('inbox.addError'));
      }
    } finally {
      setIsSaving(false);
    }
  }, [inputText, isSaving, editMode, onEdit, saveMode, onSave, showSuccessToast, showErrorToast, t, onClose, tags, setTags]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      if (!editMode) {
        setInputText("");
        setSaveMode('inbox');
      }
      setIsClosing(false);
    }, 300);
  }, [onClose, editMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (showTagSuggestions) {
          setShowTagSuggestions(false);
          setFilteredTags([]);
        } else {
          handleClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, showTagSuggestions, handleClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showTagSuggestions) {
          setShowTagSuggestions(false);
          setFilteredTags([]);
        } else {
          handleClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, showTagSuggestions, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-16 left-0 right-0 bottom-0 sm:top-16 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-[45] transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        ref={modalRef}
        className={`relative bg-white dark:bg-gray-800 border-0 sm:border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full h-full sm:h-auto sm:max-w-2xl md:max-w-3xl transform transition-transform duration-300 ${
          isClosing ? "scale-95" : "scale-100"
        } flex flex-col`}
      >
        {/* Close button - only visible on mobile */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full shadow-lg transition-colors duration-200 sm:hidden"
          aria-label="Close"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        
        <div className="flex-1 flex items-center justify-center sm:block sm:flex-none">
          <div className="w-full p-6 px-8">
          <div className="flex flex-col sm:flex-row sm:items-center relative">
            <div className="relative flex-1">
              <input
                ref={nameInputRef}
                type="text"
                name="text"
                value={inputText}
                onChange={handleChange}
                onSelect={(e) => {
                  const pos = e.currentTarget.selectionStart || 0;
                  setCursorPosition(pos);
                  // Update dropdown position if showing suggestions
                  if (showTagSuggestions) {
                    const position = calculateDropdownPosition(e.currentTarget, pos);
                    setDropdownPosition(position);
                  }
                }}
                onKeyUp={(e) => {
                  const pos = e.currentTarget.selectionStart || 0;
                  setCursorPosition(pos);
                  // Update dropdown position if showing suggestions
                  if (showTagSuggestions) {
                    const position = calculateDropdownPosition(e.currentTarget, pos);
                    setDropdownPosition(position);
                  }
                }}
                onClick={(e) => {
                  const pos = e.currentTarget.selectionStart || 0;
                  setCursorPosition(pos);
                  // Update dropdown position if showing suggestions
                  if (showTagSuggestions) {
                    const position = calculateDropdownPosition(e.currentTarget, pos);
                    setDropdownPosition(position);
                  }
                }}
                required
                className="w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                placeholder={t('inbox.captureThought')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isSaving && !showTagSuggestions) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              
              {/* Tags display like TaskItem */}
              {inputText && parseHashtags(inputText).length > 0 && (
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <TagIcon className="h-3 w-3 mr-1" />
                  <span>
                    {parseHashtags(inputText).map((tagName, index) => {
                      const tag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                      const isLast = index === parseHashtags(inputText).length - 1;
                      
                      if (tag) {
                        return (
                          <span key={index}>
                            <Link
                              to={`/tag/${tag.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tagName}
                            </Link>
                            {!isLast && ', '}
                          </span>
                        );
                      } else {
                        return (
                          <span key={index} className="text-orange-500 dark:text-orange-400">
                            {tagName}{!isLast && ', '}
                          </span>
                        );
                      }
                    })}
                  </span>
                </div>
              )}
              
              {/* Tag Suggestions Dropdown */}
              {showTagSuggestions && filteredTags.length > 0 && (
                <div 
                  className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
                  style={{
                    left: `${dropdownPosition.left}px`,
                    top: `${dropdownPosition.top + 4}px`,
                    minWidth: '120px',
                    maxWidth: '200px'
                  }}
                >
                  {filteredTags.map((tag, index) => (
                    <button
                      key={tag.id || index}
                      onClick={() => handleTagSelect(tag.name)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md"
                    >
                      #{tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputText.trim() || isSaving}
              className={`mt-4 sm:mt-0 sm:ml-4 inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none ${
                inputText.trim() && !isSaving
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-400 cursor-not-allowed"
              }`}
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
          {/* URL Preview disabled */}
          {/* <UrlPreview 
            text={inputText} 
            onPreviewChange={setUrlPreview}
          /> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxModal;