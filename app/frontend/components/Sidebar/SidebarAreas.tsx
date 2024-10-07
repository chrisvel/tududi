// src/components/Sidebar/SidebarAreas.tsx

import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { Squares2X2Icon, PlusCircleIcon } from '@heroicons/react/24/outline'; // Using outline style

interface Area {
  id: number;
  name: string;
  active: boolean;
}

interface SidebarAreasProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
}

const SidebarAreas: React.FC<SidebarAreasProps> = ({
  handleNavClick,
  location,
  isDarkMode,
}) => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas?active=true'); // Fetch only active areas
        const data = await response.json();
        if (response.ok) {
          setAreas(data.areas || []);
        } else {
          console.error('Failed to fetch areas:', data.error);
        }
      } catch (error) {
        console.error('Error fetching areas:', error);
      }
    };
    fetchAreas();
  }, []);

  const startAreaCreation = () => {
    setIsCreatingArea(true);
  };

  const handleAreaNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewAreaName(e.target.value);
  };

  const handleAreaCreation = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newAreaName.trim()) {
      try {
        const response = await fetch('/api/area', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newAreaName }),
        });

        if (response.ok) {
          const newArea = await response.json();
          setAreas((prevAreas) => [...prevAreas, newArea]);
          setNewAreaName('');
          setIsCreatingArea(false);
        } else {
          console.error('Failed to create area');
        }
      } catch (error) {
        console.error('Error creating area:', error);
      }
    }
  };

  const isActiveArea = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        {/* "AREAS" Title with Add Button */}
        <li
          className={`flex justify-between items-center px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveArea(
            '/areas'
          )}`}
          onClick={() => handleNavClick('/areas', 'Areas', 'squares2x2')}
        >
          <span className="flex items-center">
            <Squares2X2Icon className="h-5 w-5 mr-2" />
            AREAS
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startAreaCreation();
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Area"
            title="Add Area"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>

        {/* Input for New Area Creation */}
        {isCreatingArea && (
          <li className="px-4 py-1">
            <input
              type="text"
              value={newAreaName}
              onChange={handleAreaNameChange}
              onKeyDown={handleAreaCreation}
              placeholder="New area name"
              autoFocus
              className="w-full px-2 py-1 text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </li>
        )}

        {/* List of Areas */}
        {areas.map((area) => (
          <li key={area.id}>
            <button
              onClick={() =>
                handleNavClick(`/area/${area.id}`, area.name, 'squares2x2')
              }
              className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActiveArea(
                `/area/${area.id}`
              )}`}
            >
              <Squares2X2Icon className="h-5 w-5 mr-2 text-blue-500" />
              {area.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default SidebarAreas;
