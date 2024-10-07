// src/components/Area/Areas.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        {/* Areas Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Areas
          </h2>
          <Link
            to="/area/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Create New Area
          </Link>
        </div>

        {/* Areas List */}
        {areas.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No areas found.</p>
        ) : (
          <ul className="space-y-4">
            {areas.map((area) => (
              <li key={area.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                <div className="flex items-center">
                  <i className="bi bi-geo-alt-fill text-xl text-gray-500 dark:text-gray-400 mr-2"></i>
                  <Link
                    to={`/area/${area.id}`}
                    className="text-lg font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {area.name}
                  </Link>
                </div>
                {/* Optional: Edit/Delete Buttons */}
                <div className="flex space-x-2">
                  <Link
                    to={`/area/${area.id}/edit`}
                    className="text-blue-500 hover:text-blue-700"
                    aria-label={`Edit ${area.name}`}
                    title={`Edit ${area.name}`}
                  >
                    <i className="bi bi-pencil-square text-xl"></i>
                  </Link>
                  <button
                    onClick={() => handleDeleteArea(area.id)}
                    className="text-red-500 hover:text-red-700 focus:outline-none"
                    aria-label={`Delete ${area.name}`}
                    title={`Delete ${area.name}`}
                  >
                    <i className="bi bi-trash text-xl"></i>
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
