import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const About: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("0.3");

  useEffect(() => {
    // Fetch version from the deployed app
    fetch('/api/version')
      .then(response => response.json())
      .then(data => {
        if (data.version) {
          setVersion(data.version);
        }
      })
      .catch(error => {
        console.error('Error fetching version:', error);
        // Keep default version if fetch fails
      });
  }, []);

  return (
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        <div className="flex items-center mb-4">
          <InformationCircleIcon className="h-6 w-6 mr-2" />
          <h2 className="text-2xl font-light">{t('about.title', 'About')}</h2>
        </div>

        <div className="max-w-2xl mx-auto">
            {/* Logo and Version */}
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                tududi
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {t('about.version', 'Version')} {version}
              </p>
            </div>

            {/* Description */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-8">
              <p className="text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                {t('about.description', 'Self-hosted task management with hierarchical organization, multi-language support, and Telegram integration. Built with love for productivity enthusiasts.')}
              </p>
            </div>

            {/* Appreciation */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <HeartIcon className="h-6 w-6 text-red-500 mr-2" />
                <span className="text-lg font-medium text-gray-900 dark:text-white">
                  {t('about.madeWithLove', 'Made with love')}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('about.appreciation', 'Thank you for using tududi! Your support helps keep this project alive and growing. If you find it useful, consider supporting the development.')}
              </p>
            </div>

            {/* Support Links */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                {t('about.supportDevelopment', 'Support Development')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <a
                  href="https://www.patreon.com/ChrisVeleris"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors duration-200 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 .5h4.219v23H0V.5zM15.384.5c4.767 0 8.616 3.718 8.616 8.313 0 4.596-3.85 8.313-8.616 8.313-4.767 0-8.615-3.717-8.615-8.313C6.769 4.218 10.617.5 15.384.5z"/>
                  </svg>
                  Patreon
                </a>
                <a
                  href="https://coff.ee/chrisveleris"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors duration-200 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.766-1.623a4.44 4.44 0 0 0-1.209-.982c-.621-.37-1.294-.646-1.975-.804-.681-.158-1.375-.158-2.056 0-.682.158-1.354.434-1.975.804a4.44 4.44 0 0 0-1.209.982c-.378.46-.647 1.025-.766 1.623l-.132.666a.75.75 0 0 0 .735.885h8.568a.75.75 0 0 0 .735-.885zM11.5 9.5h1v8h-1v-8zM9 9.5h1v8H9v-8zM14 9.5h1v8h-1v-8z"/>
                  </svg>
                  Buy Me a Coffee
                </a>
                <a
                  href="https://github.com/sponsors/chrisvel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-800 dark:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg transition-colors duration-200 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  GitHub Sponsors
                </a>
                <a
                  href="https://www.paypal.com/donate/?hosted_button_id=QEQCKLXPB6XAE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.13-.657c-.55-2.29-2.04-3.26-5.45-3.26H9.326L7.18 15.857h2.19c4.298 0 7.664-1.747 8.647-6.797.03-.149.054-.294.077-.437.206-1.314.064-2.285-.872-2.706z"/>
                  </svg>
                  PayPal
                </a>
              </div>
            </div>

            {/* Links */}
            <div className="text-center">
              <div className="space-y-2">
                <a
                  href="https://github.com/chrisvel/tududi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                >
                  {t('about.viewOnGitHub', 'View on GitHub')}
                  <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
                <span className="block text-sm text-gray-500 dark:text-gray-400">
                  {t('about.license', 'Licensed for personal use')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('about.builtBy', 'Built by')} <a href="https://github.com/chrisvel" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Chris Veleris</a>
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default About;