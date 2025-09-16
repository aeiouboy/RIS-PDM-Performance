import React, { useState, useCallback, memo } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  UserIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  BellIcon,
  PaintBrushIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const Settings = memo(() => {
  const { user, updateUser, updatePreferences, uploadAvatar, loading, error } = useUser();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
  });
  const [preferences, setPreferences] = useState(user?.preferences || {
    theme: 'light',
    notifications: true,
    language: 'en'
  });
  const [success, setSuccess] = useState('');

  // Handle profile update
  const handleProfileSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      setSuccess('');
      await updateUser(formData);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }, [formData, updateUser]);

  // Handle preferences update
  const handlePreferencesSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      setSuccess('');
      await updatePreferences(preferences);
      setSuccess('Preferences updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  }, [preferences, updatePreferences]);

  // Handle avatar upload
  const handleAvatarUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      setSuccess('');
      await uploadAvatar(file);
      setSuccess('Avatar updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    }
  }, [uploadAvatar]);

  // Tab configuration
  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'preferences', name: 'Preferences', icon: Cog6ToothIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6 flex items-center">
            <div className="h-5 w-5 text-green-500 mr-3">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            {success}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 flex items-center">
            <div className="h-5 w-5 text-red-500 mr-3">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-dashboard border p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
              <UserIcon className="h-6 w-6 mr-2" />
              Profile Information
            </h2>

            {/* Avatar Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Photo
              </label>
              <div className="flex items-center space-x-6">
                <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-medium text-gray-500">
                      {user.name?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer cursor-pointer"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    className="block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Contact admin to change role</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-lg shadow-dashboard border p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
              <Cog6ToothIcon className="h-6 w-6 mr-2" />
              User Preferences
            </h2>

            <form onSubmit={handlePreferencesSubmit} className="space-y-6">
              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <PaintBrushIcon className="h-5 w-5 inline mr-2" />
                  Theme Preference
                </label>
                <div className="space-y-2">
                  {[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        checked={preferences.theme === option.value}
                        onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        disabled={loading}
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <BellIcon className="h-5 w-5 inline mr-2" />
                  Notifications
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.notifications || false}
                      onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      disabled={loading}
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable desktop notifications</span>
                  </label>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <GlobeAltIcon className="h-5 w-5 inline mr-2" />
                  Language
                </label>
                <select
                  value={preferences.language || 'en'}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                  className="block w-full md:w-48 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  disabled={loading}
                >
                  <option value="en">English</option>
                  <option value="th">ไทย (Thai)</option>
                  <option value="zh">中文 (Chinese)</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-lg shadow-dashboard border p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
              <ShieldCheckIcon className="h-6 w-6 mr-2" />
              Security Settings
            </h2>
            
            <div className="space-y-6">
              {/* Password Change */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">Change Password</h3>
                <p className="text-sm text-gray-600 mb-4">Update your password to keep your account secure</p>
                <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">
                  Change Password
                </button>
              </div>

              {/* Two-Factor Authentication */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-600 mb-4">Add an extra layer of security to your account</p>
                <button className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">
                  Enable 2FA
                </button>
              </div>

              {/* Active Sessions */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-md font-medium text-gray-900 mb-2">Active Sessions</h3>
                <p className="text-sm text-gray-600 mb-4">Manage devices that are currently signed in</p>
                <div className="bg-gray-50 rounded-md p-3 mb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Session</p>
                      <p className="text-xs text-gray-500">macOS • Chrome • Bangkok, Thailand</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>
                </div>
                <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">
                  View All Sessions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Set display name for debugging (RIS PDM convention)
Settings.displayName = 'Settings';

export default Settings;