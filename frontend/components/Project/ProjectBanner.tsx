import React, { RefObject } from 'react';
import {
    TagIcon,
    Squares2X2Icon,
    PencilSquareIcon,
    TrashIcon,
    ShareIcon,
    CameraIcon,
} from '@heroicons/react/24/outline';
import BannerBadge from '../Shared/BannerBadge';
import { Project } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { useNavigate } from 'react-router-dom';
import { TFunction } from 'i18next';
import {
    getCreatorFromBannerUrl,
    isPresetBanner,
} from '../../utils/bannersService';
import { getAssetPath } from '../../config/paths';

interface ProjectBannerProps {
    project: Project;
    areas: Area[];
    t: TFunction;
    getStateIcon: (state: string) => React.ReactNode;
    onDeleteClick: () => void;
    editButtonRef: RefObject<HTMLButtonElement>;
    onEditBannerClick?: () => void;
}

const ProjectBanner: React.FC<ProjectBannerProps> = ({
    project,
    areas,
    t,
    getStateIcon,
    onDeleteClick,
    editButtonRef,
    onEditBannerClick,
}) => {
    const navigate = useNavigate();
    const creatorName =
        project.image_url && isPresetBanner(project.image_url)
            ? getCreatorFromBannerUrl(project.image_url)
            : null;

    return (
        <div className="w-full">
            <div className="mb-6 overflow-hidden relative group">
                {project.image_url ? (
                    <img
                        src={getAssetPath(project.image_url)}
                        alt={project.name}
                        className="w-full h-[282px] object-cover"
                    />
                ) : (
                    <div className="w-full h-[282px] bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700"></div>
                )}

                {creatorName && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        Photo by {creatorName}
                    </div>
                )}

                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <div className="text-center px-4">
                        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
                            {project.name}
                        </h1>
                        {project.description && (
                            <p className="text-lg md:text-xl text-white/90 mt-2 font-light drop-shadow-md max-w-2xl mx-auto">
                                {project.description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="absolute bottom-2 left-2 right-14 flex items-center flex-wrap gap-2">
                    {project.state && (
                        <BannerBadge>
                            {getStateIcon(project.state)}
                            <span className="text-xs text-white/90 font-medium">
                                {t(`projects.states.${project.state}`)}
                            </span>
                        </BannerBadge>
                    )}

                    {project.tags && project.tags.length > 0 && (
                        <BannerBadge>
                            <TagIcon className="h-3 w-3 text-white/70 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-white/90 font-medium">
                                {project.tags.map((tag, index) => (
                                    <React.Fragment
                                        key={tag.uid || tag.id || index}
                                    >
                                        <button
                                            onClick={() => {
                                                if (tag.uid) {
                                                    const slug = tag.name
                                                        .toLowerCase()
                                                        .replace(
                                                            /[^a-z0-9]+/g,
                                                            '-'
                                                        )
                                                        .replace(/^-|-$/g, '');
                                                    navigate(
                                                        `/tag/${tag.uid}-${slug}`
                                                    );
                                                } else {
                                                    navigate(
                                                        `/tag/${encodeURIComponent(tag.name)}`
                                                    );
                                                }
                                            }}
                                            className="hover:text-blue-200 transition-colors cursor-pointer"
                                        >
                                            {tag.name}
                                        </button>
                                        {index <
                                            (project.tags?.length || 0) - 1 && (
                                            <span className="text-white/60">
                                                ,{' '}
                                            </span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </span>
                        </BannerBadge>
                    )}

                    {(project.area || (project as any).Area) && (
                        <BannerBadge>
                            <Squares2X2Icon className="h-3 w-3 text-white/70 flex-shrink-0 mt-0.5" />
                            <button
                                onClick={() => {
                                    const projectArea =
                                        project.area || (project as any).Area;
                                    const area = areas.find(
                                        (a) => a.id === projectArea.id
                                    );
                                    const areaUid = area?.uid;
                                    if (!areaUid) return;
                                    const areaSlug = projectArea.name
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]+/g, '-')
                                        .replace(/^-|-$/g, '');
                                    navigate(
                                        `/projects?area=${areaUid}-${areaSlug}`
                                    );
                                }}
                                className="text-xs text-white/90 hover:text-blue-200 transition-colors cursor-pointer font-medium"
                            >
                                {(project.area || (project as any).Area)?.name}
                            </button>
                        </BannerBadge>
                    )}

                    {project.is_shared && (
                        <BannerBadge>
                            <ShareIcon className="h-3 w-3 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-white/90 font-medium">
                                {t('projects.shared', 'Shared')}
                            </span>
                        </BannerBadge>
                    )}
                </div>

                <div className="absolute bottom-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {onEditBannerClick && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEditBannerClick();
                            }}
                            className="p-2 bg-black bg-opacity-50 text-purple-400 hover:text-purple-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                            title={t('project.editBanner', 'Edit Banner')}
                        >
                            <CameraIcon className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        ref={editButtonRef}
                        type="button"
                        className="p-2 bg-black bg-opacity-50 text-blue-400 hover:text-blue-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                    >
                        <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteClick();
                        }}
                        className="p-2 bg-black bg-opacity-50 text-red-400 hover:text-red-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectBanner;
