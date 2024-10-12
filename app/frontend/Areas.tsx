import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid'; // Heroicons for edit and delete

interface Area {
  id: number;
  name: string;
  description?: string;
}

const Areas: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas', {
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Accept': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok) {
          setAreas(data);
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

  const handleDeleteArea = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this area?')) return;

    try {
      const response = await fetch(`/api/areas/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        setAreas((prevAreas) => prevAreas.filter((area) => area.id !== id));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete area.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
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
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="flex justify-center px-4 py-6">
      <div className="w-full max-w-4xl">
        {/* Areas Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Areas</h2>
        </div>

        {/* Areas List */}
        {areas.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No areas found.</p>
        ) : (
          <ul className="space-y-2">
            {areas.map((area) => (
              <li key={area.id} className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center">
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
                    onClick={() => navigate(`/area/${area.id}/edit`)}
                    className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                    aria-label={`Edit ${area.name}`}
                    title={`Edit ${area.name}`}
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteArea(area.id)}
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
      </div>
    </div>
  );
};

export default Areas;
