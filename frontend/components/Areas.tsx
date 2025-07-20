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

                {/* Areas Grid */}
                {areas.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('areas.noAreasFound')}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {areas.map((area) => (
                            <Link
                                key={area.id}
                                to={`/projects?area_id=${area.id}`}
                                className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col group hover:ring-2 hover:ring-blue-200 dark:hover:ring-blue-700 hover:ring-opacity-50 transition-all duration-300 ease-in-out cursor-pointer"
                                style={{
                                    minHeight: '200px',
                                    maxHeight: '200px',
                                }}
                                onMouseEnter={() =>
                                    setHoveredAreaId(area.id || null)
                                }
                                onMouseLeave={() => setHoveredAreaId(null)}
                            >
                                {/* Area Content - Centered */}
                                <div className="p-4 flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <h3 className="text-xl font-light text-gray-900 dark:text-gray-100 line-clamp-2 uppercase">
                                            {area.name}
                                        </h3>
                                        {area.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                                                {area.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons - Bottom Right */}
                                <div className="absolute bottom-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleEditArea(area);
                                        }}
                                        className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
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
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openConfirmDialog(area);
                                        }}
                                        className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
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
                            </Link>
                        ))}
                    </div>
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
