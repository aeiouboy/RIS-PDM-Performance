import React, { useCallback, useState, memo } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useUser } from '../contexts/UserContext';
import ProjectLogo from '../components/ProjectLogo';

const LoginPage = memo(() => {
  const { loginWithGoogle, loading, error } = useUser();
  const [localError, setLocalError] = useState(null);

  const handleSuccess = useCallback(async (response) => {
    setLocalError(null);
    try {
      await loginWithGoogle(response.credential);
    } catch (err) {
      // Error is already set in context, but keep a local fallback.
      console.error('Google sign-in failed:', err);
    }
  }, [loginWithGoogle]);

  const handleError = useCallback(() => {
    setLocalError('Google sign-in failed. Please try again.');
  }, []);

  const displayError = error || localError;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ProjectLogo size="lg" showText={true} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-dashboard rounded-lg sm:px-10">
          {/* Error Display */}
          {displayError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 flex items-center">
              <div className="h-5 w-5 text-red-500 mr-3">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              {displayError}
            </div>
          )}

          <div className="flex flex-col items-center space-y-4">
            {loading ? (
              <div className="flex items-center text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500 mr-2"></div>
                Signing in...
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                theme="filled_blue"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            )}

            <p className="text-sm text-gray-500 text-center">
              Use your @central.co.th Google account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

LoginPage.displayName = 'LoginPage';

export default LoginPage;
