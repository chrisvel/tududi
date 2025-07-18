import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAreaByUid } from '../../utils/areasService';
import { Area } from '../../entities/Area';
import { useTranslation } from 'react-i18next';

const AreaDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uid } = useParams<{ uid: string }>();
    const [area, setArea] = useState<Area | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const fetchArea = async () => {
            if (!uid) {
                setIsError(true);
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const foundArea = await fetchAreaByUid(uid);
                setArea(foundArea || null);
                if (!foundArea) {
                    setIsError(true);
                }
            } catch (err) {
                console.error('Error fetching area:', err);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };
        fetchArea();
    }, [uid]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('areas.loading')}
                </div>
            </div>
        );
    }

    if (isError || !area) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    {isError ? t('areas.error') : t('areas.notFound')}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {t('areas.details')}: {area?.name}
                </h2>
                <p className="text-md text-gray-700 dark:text-gray-300">
                    {area?.description}
                </p>
                <Link
                    to={`/projects?area_id=${area?.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline mt-4 block"
                >
                    {t('areas.viewProjects', { name: area?.name })}
                </Link>
            </div>
        </div>
    );
};

export default AreaDetails;
