import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Tag {
  id: number;
  name: string;
  active: boolean;
}

const TagDetails: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); 

  useEffect(() => {
    const fetchTag = async () => {
      try {
        const response = await fetch(`/api/tag/${id}`);
        const data = await response.json();
        if (response.ok) {
          setTag(data);
        } else {
          setError(data.error || 'Failed to fetch tag.');
        }
      } catch (err) {
        setError(t('tags.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchTag();
  }, [id]);

  const handleViewTasks = () => {
    if (tag) {
      navigate(`/tasks?tag=${encodeURIComponent(tag.name)}`); 
    }
  };

  if (loading) {
    return <div className="text-gray-700 dark:text-gray-300">{t('tags.loading')}</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!tag) {
    return <div className="text-gray-700 dark:text-gray-300">{t('tags.notFound')}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">{t('tags.details')}</h2>
      <p className="text-gray-700 dark:text-gray-300">
        <strong>{t('tags.name')}:</strong> {tag.name}
      </p>
      <p className="text-gray-700 dark:text-gray-300">
        <strong>{t('tags.status')}:</strong> {tag.active ? t('tags.active') : t('tags.inactive')}
      </p>

      {/* "View tasks with this tag" button */}
      <button
        onClick={handleViewTasks}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        {t('tags.viewTasksWithTag')}
      </button>
    </div>
  );
};

export default TagDetails;
