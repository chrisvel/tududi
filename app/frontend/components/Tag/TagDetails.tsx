import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Tag {
  id: number;
  name: string;
  active: boolean;
}

const TagDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); // Use the `useNavigate` hook for navigation

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
        setError('Error fetching tag.');
      } finally {
        setLoading(false);
      }
    };
    fetchTag();
  }, [id]);

  // Function to handle the redirection to tasks with the tag
  const handleViewTasks = () => {
    if (tag) {
      navigate(`/tasks?tag=${encodeURIComponent(tag.name)}`); // Redirect to the tasks page with the tag as a query param
    }
  };

  if (loading) {
    return <div className="text-gray-700 dark:text-gray-300">Loading tag details...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!tag) {
    return <div className="text-gray-700 dark:text-gray-300">Tag not found.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Tag Details</h2>
      <p className="text-gray-700 dark:text-gray-300">
        <strong>Name:</strong> {tag.name}
      </p>
      <p className="text-gray-700 dark:text-gray-300">
        <strong>Status:</strong> {tag.active ? 'Active' : 'Inactive'}
      </p>

      {/* "View tasks with this tag" button */}
      <button
        onClick={handleViewTasks}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        View tasks with this tag
      </button>
    </div>
  );
};

export default TagDetails;
