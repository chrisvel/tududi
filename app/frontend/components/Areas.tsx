import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PencilSquareIcon,
  TrashIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/solid'; 
import ConfirmDialog from './Shared/ConfirmDialog';
import AreaModal from './Area/AreaModal'; 
import { useDataContext } from '../contexts/DataContext';
import { Area } from '../entities/Area';

const Areas: React.FC = () => {
  const { areas, isLoading, isError, createArea, updateArea, deleteArea } = useDataContext();
  const [isAreaModalOpen, setIsAreaModalOpen] = useState<boolean>(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

  const handleSaveArea = async (areaData: Area) => {
    try {
      if (areaData.id) {
        await updateArea(areaData.id, {
          name: areaData.name,
          description: areaData.description,
        });
      } else {
        await createArea({
          name: areaData.name,
          description: areaData.description,
        });
      }
    } catch (error) {
      console.error('Error saving area:', error);
    } finally {
      setIsAreaModalOpen(false);
      setSelectedArea(null);
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

  const openConfirmDialog = (area: Area) => {
    setAreaToDelete(area);
    setIsConfirmDialogOpen(true);
  };

  const handleDeleteArea = async () => {
    if (!areaToDelete) return;

    try {
      await deleteArea(areaToDelete.id!);
      setIsConfirmDialogOpen(false);
      setAreaToDelete(null);
    } catch (error) {
      console.error('Error deleting area:', error);
    }
  };

  const closeConfirmDialog = () => {
    setIsConfirmDialogOpen(false);
    setAreaToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading areas...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 p-4">
        An error occurred while fetching areas.
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-5xl">
        {/* Areas Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Squares2X2Icon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">
              Areas
            </h2>
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
                    to={`/projects?area_id=${area.id}`}
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
