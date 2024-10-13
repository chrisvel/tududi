import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon, Squares2X2Icon } from '@heroicons/react/24/solid'; // Icons for edit, delete, and area
import ConfirmDialog from './components/Shared/ConfirmDialog'; // Import ConfirmDialog
import AreaModal from './components/Area/AreaModal'; // Import AreaModal
import { Area } from './entities/Area'; // Import Area entity

const Areas: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAreaModalOpen, setIsAreaModalOpen] = useState<boolean>(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null); // For editing
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

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
          throw new Error(data.error || 'Failed to fetch areas.');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchAreas();
  }, []);

  const handleDeleteArea = async () => {
    if (!areaToDelete) return;

    try {
      const response = await fetch(`/api/areas/${areaToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        setAreas((prevAreas) => prevAreas.filter((area) => area.id !== areaToDelete.id));
        setIsConfirmDialogOpen(false);
        setAreaToDelete(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete area.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEditArea = (area: Area) => {
    setSelectedArea(area);
    setIsAreaModalOpen(true);
  };

  const handleCreateArea = () => {
    setSelectedArea(null);
    setIsAreaModalOpen(true);
  };

  const handleSaveArea = async (areaData: Area) => {
    if (areaData.id) {
      // Update existing area
      try {
        const response = await fetch(`/api/areas/${areaData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(areaData),
        });

        if (response.ok) {
          const updatedArea = await response.json();
          setAreas((prevAreas) =>
            prevAreas.map((a) => (a.id === updatedArea.id ? updatedArea : a))
          );
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update area.');
        }
      } catch (error) {
        setError((error as Error).message);
      }
    } else {
      // Create new area
      try {
        const response = await fetch('/api/areas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(areaData),
        });

        if (response.ok) {
          const newArea = await response.json();
          setAreas((prevAreas) => [...prevAreas, newArea]);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create area.');
        }
      } catch (error) {
        setError((error as Error).message);
      }
    }

    setIsAreaModalOpen(false);
    setSelectedArea(null);
  };

  const openConfirmDialog = (area: Area) => {
    setAreaToDelete(area);
    setIsConfirmDialogOpen(true);
  };

  const closeConfirmDialog = () => {
    setIsConfirmDialogOpen(false);
    setAreaToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading areas...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Areas Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Squares2X2Icon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">Areas</h2>
          </div>
        </div>

        {/* Areas List */}
        {areas.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No areas found.</p>
        ) : (
          <ul className="space-y-2">
            {areas.map((area) => (
              <li
                key={area.id}
                className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center"
              >
                {/* Area Content */}
                <div className="flex-grow overflow-hidden pr-4">
                  <Link
                    to={`/area/${area.id}`}
                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline block"
                  >
                    {area.name}
                  </Link>
                  {area.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                      {area.description}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditArea(area)}
                    className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                    aria-label={`Edit ${area.name}`}
                    title={`Edit ${area.name}`}
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => openConfirmDialog(area)}
                    className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                    aria-label={`Delete ${area.name}`}
                    title={`Delete ${area.name}`}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* AreaModal */}
        {isAreaModalOpen && (
          <AreaModal
            isOpen={isAreaModalOpen}
            onClose={() => setIsAreaModalOpen(false)}
            onSave={handleSaveArea}
            area={selectedArea}
          />
        )}

        {/* ConfirmDialog */}
        {isConfirmDialogOpen && areaToDelete && (
          <ConfirmDialog
            title="Delete Area"
            message={`Are you sure you want to delete the area "${areaToDelete.name}"?`}
            onConfirm={handleDeleteArea}
            onCancel={closeConfirmDialog}
          />
        )}
      </div>
    </div>
  );
};

export default Areas;
