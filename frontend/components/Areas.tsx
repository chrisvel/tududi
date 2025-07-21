import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
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
    const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(null);
            }
        };

        if (dropdownOpen !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

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
                                    minHeight: '120px',
                                    maxHeight: '120px',
                                }}
                            >
                                {/* Area Content - Centered */}
                                <div className="p-4 flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <h3 className="text-lg font-light text-gray-900 dark:text-gray-100 line-clamp-2 uppercase">
                                            {area.name}
                                        </h3>
                                        {area.description && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                                                {area.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Three Dots Dropdown - Bottom Right */}
                                <div
                                    className="absolute bottom-2 right-2"
                                    ref={dropdownRef}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDropdownOpen(
                                                dropdownOpen === area.id
                                                    ? null
                                                    : area.id!
                                            );
                                        }}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        aria-label={t(
                                            'areas.toggleDropdownMenu'
                                        )}
                                    >
                                        <EllipsisVerticalIcon className="h-5 w-5" />
                                    </button>

                                    {dropdownOpen === area.id && (
                                        <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-50">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleEditArea(area);
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                            >
                                                {t('areas.edit', 'Edit')}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openConfirmDialog(area);
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                            >
                                                {t('areas.delete', 'Delete')}
                                            </button>
                                        </div>
                                    )}
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
