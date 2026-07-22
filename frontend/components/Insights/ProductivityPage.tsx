import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { fetchProjects } from '../../utils/projectsService';
import ProductivityAssistant from '../Productivity/ProductivityAssistant';

const ProductivityPage: React.FC = () => {
    const { t } = useTranslation();
    const { tasks, isLoading: tasksLoading, loadTasks } = useStore((state) => state.tasksStore);
    const [projects, setProjects] = useState<any[]>([]);

    useEffect(() => {
        if (tasks.length === 0) {
            loadTasks();
        }
        fetchProjects()
            .then((data) => setProjects(data || []))
            .catch(console.error);
    }, []);

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center mb-8">
                    <h2 className="text-2xl font-light">
                        {t('sidebar.productivityAssistant', 'Productivity Assistant')}
                    </h2>
                </div>
                {tasksLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                    </div>
                ) : (
                    <ProductivityAssistant tasks={tasks} projects={projects} />
                )}
            </div>
        </div>
    );
};

export default ProductivityPage;
