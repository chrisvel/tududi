import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDataContext } from '../../contexts/DataContext'; // Import the DataContext

const AreaDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { areas, isLoading, isError } = useDataContext(); // Get areas and loading/error state from DataContext
  const [area, setArea] = useState<any | null>(null); // Allow flexibility in the type for now

  useEffect(() => {
    // Find the area with the matching ID from the DataContext
    const foundArea = areas.find((a) => a.id === Number(id));
    setArea(foundArea || null);
  }, [id, areas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading area details...
        </div>
      </div>
    );
  }

  if (isError || !area) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="textpro-red-500 text-lg">
          {isError ? 'Error loading area details.' : 'Area not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Area: {area?.name}
        </h2>
        <p className="text-md text-gray-700 dark:text-gray-300">{area?.description}</p>
        <Link
          to={`/projects?area_id=${area?.id}`}
          className="text-blue-600 dark:text-blue-400 hover:underline mt-4 block"
        >
          View Projects in {area?.name}
        </Link>
      </div>
    </div>
  );
};

export default AreaDetails;
