import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    EllipsisVerticalIcon,
    FolderIcon,
    FlagIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
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

    // Use global store for consistency
    const {
        areas,
        isLoading: loading,
        hasLoaded,
        loadAreas,
    } = useStore((state: any) => state.areasStore);

    const [isAreaModalOpen, setIsAreaModalOpen] = useState<boolean>(false);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef<boolean>(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hasLoaded && !loading) {
            loadAreas();
        }
    }, [hasLoaded, loading, loadAreas]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Skip if dropdown was just opened
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }

            const clickedElement = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(clickedElement)
            ) {
                setDropdownOpen(null);
            }
        };

        if (dropdownOpen !== null) {
            // Add a small delay to prevent immediate closing
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleSaveArea = async (areaData: Partial<Area>) => {
        try {
            useStore.getState().areasStore.setLoading(true);
            let result: Area;
            if (areaData.uid) {
                result = await updateArea(areaData.uid, {
                    name: areaData.name,
                    description: areaData.description,
                    color: areaData.color,
                });
                // Update the existing area in the list
                const currentAreas = useStore.getState().areasStore.areas;
                useStore
                    .getState()
                    .areasStore.setAreas(
                        currentAreas.map((area: any) =>
                            area.uid === result.uid ? result : area
                        )
                    );
            } else {
                result = await createArea({
                    name: areaData.name,
                    description: areaData.description,
                    color: areaData.color,
                });

                // Add the new area immediately to global state
                const currentAreas = useStore.getState().areasStore.areas;
                const newAreas = [...currentAreas, result];
                useStore.getState().areasStore.setAreas(newAreas);
            }

            // Close modal only on success
            setIsAreaModalOpen(false);
            setSelectedArea(null);
            useStore.getState().areasStore.setError(false);
        } catch (error) {
            console.error('Error saving area:', error);
            useStore.getState().areasStore.setError(true);
        } finally {
            useStore.getState().areasStore.setLoading(false);
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

        useStore.getState().areasStore.setLoading(true);
        try {
            await deleteArea(areaToDelete.uid!);
            // Remove the area from global state immediately
            const currentAreas = useStore.getState().areasStore.areas;
            useStore
                .getState()
                .areasStore.setAreas(
                    currentAreas.filter(
                        (area: any) => area.uid !== areaToDelete.uid
                    )
                );
            setIsConfirmDialogOpen(false);
            setAreaToDelete(null);
            useStore.getState().areasStore.setError(false);
        } catch (error) {
            console.error('Error deleting area:', error);
            useStore.getState().areasStore.setError(true);
        } finally {
            useStore.getState().areasStore.setLoading(false);
        }
    };

    const closeConfirmDialog = () => {
        setIsConfirmDialogOpen(false);
        setAreaToDelete(null);
    };

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
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
                        {areas.map((area: any) => (
                            <Link
                                key={area.uid}
                                to={
                                    area.uid
                                        ? `/area/${area.uid}-${area.name
                                              .toLowerCase()
                                              .replace(/[^a-z0-9]+/g, '-')
                                              .replace(/^-|-$/g, '')}`
                                        : `/areas`
                                }
                                className={`rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer ${
                                    !area.color
                                        ? 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                        : ''
                                } ${dropdownOpen === area.uid ? 'z-50' : ''}`}
                                style={area.color ? { backgroundColor: area.color } : {}}
                            >
                                {/* Three Dots Dropdown - Top Right */}
                                <div
                                    className="absolute top-2 right-2 z-10"
                                    ref={dropdownRef}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newDropdownState =
                                                dropdownOpen === area.uid
                                                    ? null
                                                    : area.uid!;
                                            if (newDropdownState !== null) {
                                                justOpenedRef.current = true;
                                            }
                                            setDropdownOpen(newDropdownState);
                                        }}
                                        className={`focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded ${
                                            area.color
                                                ? 'text-white/60 hover:text-white hover:bg-white/20'
                                                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                        aria-label={t('areas.toggleDropdownMenu')}
                                        data-testid={`area-dropdown-${area.uid}`}
                                    >
                                        <EllipsisVerticalIcon className="h-4 w-4" />
                                    </button>

                                    {dropdownOpen === area.uid && (
                                        <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleEditArea(area);
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                                data-testid={`area-edit-${area.uid}`}
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
                                                data-testid={`area-delete-${area.uid}`}
                                            >
                                                {t('areas.delete', 'Delete')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Name + Description */}
                                <div className="px-5 pt-6 pb-4 flex-1 flex items-center justify-center text-center">
                                    <div>
                                        <h3
                                            className={`text-sm font-semibold tracking-widest uppercase line-clamp-2 ${
                                                area.color
                                                    ? 'text-white'
                                                    : 'text-gray-800 dark:text-gray-100'
                                            }`}
                                        >
                                            {area.name}
                                        </h3>
                                        {area.description && (
                                            <p
                                                className={`text-xs mt-2 line-clamp-2 leading-relaxed ${
                                                    area.color
                                                        ? 'text-white/70'
                                                        : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                            >
                                                {area.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Stats Footer */}
                                <div
                                    className={`rounded-b-xl flex items-stretch divide-x ${
                                        area.color
                                            ? 'bg-black/20 divide-white/10'
                                            : 'bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600'
                                    }`}
                                >
                                    {[
                                        {
                                            icon: <FolderIcon className="h-3.5 w-3.5" />,
                                            count: area.projects_count ?? 0,
                                            label: t('areas.stats.projects', 'projects'),
                                        },
                                        {
                                            icon: <FlagIcon className="h-3.5 w-3.5" />,
                                            count: area.goals_count ?? 0,
                                            label: t('areas.stats.goals', 'goals'),
                                        },
                                        {
                                            icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
                                            count: area.tasks_count ?? 0,
                                            label: t('areas.stats.tasks', 'tasks'),
                                        },
                                    ].map(({ icon, count, label }) => (
                                        <div
                                            key={label}
                                            className="flex-1 flex flex-col items-center py-3 gap-1"
                                        >
                                            <span
                                                className={`text-base font-semibold leading-none ${
                                                    area.color
                                                        ? 'text-white'
                                                        : 'text-gray-700 dark:text-gray-200'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                            <span
                                                className={`flex items-center gap-1 text-[10px] leading-none ${
                                                    area.color
                                                        ? 'text-white/55'
                                                        : 'text-gray-400 dark:text-gray-500'
                                                }`}
                                            >
                                                {icon}
                                                {label}
                                            </span>
                                        </div>
                                    ))}
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
                        onDelete={async (areaUid: string) => {
                            try {
                                await deleteArea(areaUid);
                                const updatedAreas = await fetchAreas();
                                useStore
                                    .getState()
                                    .areasStore.setAreas(updatedAreas);
                                setIsAreaModalOpen(false);
                                setSelectedArea(null);
                            } catch (error) {
                                console.error(
                                    'Error deleting area from modal:',
                                    error
                                );
                                useStore.getState().areasStore.setError(true);
                            }
                        }}
                        area={selectedArea}
                    />
                )}

                {/* ConfirmDialog */}
                {isConfirmDialogOpen && areaToDelete && (
                    <ConfirmDialog
                        title={t('modals.deleteArea.title')}
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
