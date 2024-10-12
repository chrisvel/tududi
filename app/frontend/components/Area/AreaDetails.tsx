import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const AreaDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [area, setArea] = useState<any | null>(null); // Allow flexibility in the type for now
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArea = async () => {
      try {
        const response = await fetch(`/api/areas/${id}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch area details');
        }

        const data = await response.json();

        if (typeof data === 'object' && data !== null) {
          setArea(data); // Handle valid JSON data
        } else {
          throw new Error('Unexpected response format');
        }
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchArea();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading area details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  if (!area) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">Area not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Area: {area?.name}
        </h2>
        <Link to={`/projects?area_id=${area?.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          View Projects in {area?.name}
        </Link>
      </div>
    </div>
  );
};

export default AreaDetails;
