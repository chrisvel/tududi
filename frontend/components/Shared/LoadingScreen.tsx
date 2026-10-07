import React from 'react';
import i18n from 'i18next';

interface LoadingScreenProps {
    fullScreen?: boolean;
}

// Inside the app layout it must fill its container, not the viewport, or it
// spills past the sidebar and navbar.
const LoadingScreen: React.FC<LoadingScreenProps> = ({
    fullScreen = false,
}) => (
    <div
        className={
            fullScreen
                ? 'flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900'
                : 'flex w-full items-center justify-center py-16'
        }
    >
        <div className="text-lg text-gray-700 dark:text-gray-200">
            {fullScreen
                ? i18n.t(
                      'common.appLoading',
                      'Loading application... Please wait.'
                  )
                : i18n.t('common.loading', 'Loading...')}
        </div>
    </div>
);

export default LoadingScreen;
