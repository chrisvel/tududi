import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';

interface ProfileSettingsProps {
  currentUser: { id: number; email: string };
}

interface Profile {
  id: number;
  email: string;
  appearance: 'light' | 'dark';
  language: string;
  timezone: string;
  avatar_image: string | null;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    appearance: 'light',
    language: 'en',
    timezone: 'UTC',
    avatar_image: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile', {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch profile.');
        }
        const data: Profile = await response.json();
        setProfile(data);
        setFormData({
          appearance: data.appearance,
          language: data.language,
          timezone: data.timezone,
          avatar_image: data.avatar_image || '',
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, avatar_image: reader.result as string }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile.');
      }

      const updatedProfile: Profile = await response.json();
      setProfile(updatedProfile);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading profile settings...
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

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Profile Settings
      </h2>

      {success && <div className="mb-4 text-green-500">{success}</div>}
      {error && <div className="mb-4 text-red-500">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Appearance Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Appearance
          </label>
          <select
            name="appearance"
            value={formData.appearance}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {/* Language Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Language
          </label>
          <select
            name="language"
            value={formData.language}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            {/* Add more languages if necessary */}
          </select>
        </div>

        {/* Timezone Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Timezone
          </label>
          <select
            name="timezone"
            value={formData.timezone}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>
        </div>

        {/* Avatar Image Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Avatar Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-200 dark:hover:file:bg-gray-600"
          />
          {formData.avatar_image && (
            <img
              src={formData.avatar_image}
              alt="Avatar Preview"
              className="mt-2 h-24 w-24 rounded-full object-cover"
            />
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
