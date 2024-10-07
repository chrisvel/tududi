// src/components/Tag/TagDetails.tsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

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

  useEffect(() => {
    const fetchTag = async () => {
      try {
        const response = await fetch(`/api/tag/${id}`);
        const data = await response.json();
        if (response.ok) {
          setTag(data.tag);
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
      {/* Add more tag details and functionalities as needed */}
    </div>
  );
};

export default TagDetails;
