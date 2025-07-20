import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import AreaModal from './Area/AreaModal';
import { useStore } from '../store/useStore';
import {
    fetchAreas,
    createArea,
    updateArea,
    deleteArea,
} from '../utils/areasService';
import { Area } from '../entities/Area';

const Areas: React.FC = () => {
    const { t } = useTranslation();
    const { areas, setAreas, setLoading, setError } = useStore(
        (state) => state.areasStore
    );

    const [isAreaModalOpen, setIsAreaModalOpen] = useState<boolean>(false);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
    const [hoveredAreaId, setHoveredAreaId] = useState<number | null>(null);

    useEffect(() => {
        const loadAreas = async () => {
            try {
                const areasData = await fetchAreas();
                setAreas(areasData);
            } catch (error) {
                console.error('Error fetching areas:', error);
                setError(true);
            }
        };

        loadAreas();
    }, []);

    const handleSaveArea = async (areaData: Partial<Area>) => {
        setLoading(true);
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
            const updatedAreas = await fetchAreas();
            setAreas(updatedAreas);
        } catch (error) {
            console.error('Error saving area:', error);
            setError(true);
        } finally {
            setLoading(false);
            setIsAreaModalOpen(false);
            setSelectedArea(null);
        }
    };

    const handleEditArea = (area: Area) => {
        setSelectedArea(area);
        setIsAreaModalOpen(true);
    };

    const openConfirmDialog = (area: Area) => {
        setAreaToDelete(area);
        setIsConfirmDialogOpen(true);
    };

    const handleDeleteArea = async () => {
        if (!areaToDelete) return;

        setLoading(true);
        try {
            await deleteArea(areaToDelete.id!);
            const updatedAreas = await fetchAreas();
            setAreas(updatedAreas);
            setIsConfirmDialogOpen(false);
            setAreaToDelete(null);
        } catch (error) {
            console.error('Error deleting area:', error);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const closeConfirmDialog = () => {
        setIsConfirmDialogOpen(false);
        setAreaToDelete(null);
    };

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Areas Header */}
                <div className="flex items-center mb-8">
                    <h2 className="text-2xl font-light">{t('areas.title')}</h2>
                </div>

                {/* Areas List */}
                {areas.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('areas.noAreasFound')}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {areas.map((area) => (
                            <li
                                key={area.id}
                                className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center"
                                onMouseEnter={() =>
                                    setHoveredAreaId(area.id || null)
                                }
                                onMouseLeave={() => setHoveredAreaId(null)}
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
                                        className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${
                                            hoveredAreaId === area.id
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        }`}
                                        aria-label={t(
                                            'areas.editAreaAriaLabel',
                                            { name: area.name }
                                        )}
                                        title={t('areas.editAreaTitle', {
                                            name: area.name,
                                        })}
                                    >
                                        <PencilSquareIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => openConfirmDialog(area)}
                                        className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${
                                            hoveredAreaId === area.id
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        }`}
                                        aria-label={t(
                                            'areas.deleteAreaAriaLabel',
                                            { name: area.name }
                                        )}
                                        title={t('areas.deleteAreaTitle', {
                                            name: area.name,
                                        })}
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
                        onDelete={async (areaId) => {
                            try {
                                await deleteArea(areaId);
                                const updatedAreas = await fetchAreas();
                                setAreas(updatedAreas);
                                setIsAreaModalOpen(false);
                                setSelectedArea(null);
                            } catch (error) {
                                console.error('Error deleting area:', error);
                                setError(true);
                            }
                        }}
                        area={selectedArea}
                    />
                )}

                {/* ConfirmDialog */}
                {isConfirmDialogOpen && areaToDelete && (
                    <ConfirmDialog
                        title={t('modals.deleteArea.title')}
                        message={t('modals.deleteArea.message', {
                            name: areaToDelete.name,
                        })}
                        onConfirm={handleDeleteArea}
                        onCancel={closeConfirmDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default Areas;
