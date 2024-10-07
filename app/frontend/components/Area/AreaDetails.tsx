// src/components/Area/AreaDetails.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Area } from '../../entities/Area';

const AreaDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [area, setArea] = useState<Area | null>(null);
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
        const data = await response.json();
        if (response.ok) {
          setArea(data);
        } else {
          throw new Error(data.error || 'Failed to fetch area.');
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
    return <div>Loading area details...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Area: {area?.name}
        </h2>
        {/* Add more area-related information here */}
        <Link to={`/projects?area_id=${area?.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          View Projects in {area?.name}
        </Link>
      </div>
    </div>
  );
};

export default AreaDetails;
