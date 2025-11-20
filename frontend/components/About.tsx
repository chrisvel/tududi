import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartIcon } from '@heroicons/react/24/outline';
import { getApiPath } from '../config/paths';

interface AboutProps {
    isDarkMode?: boolean;
}

const About: React.FC<AboutProps> = ({ isDarkMode = false }) => {
    const { t } = useTranslation();
    const [version, setVersion] = useState<string>('0.3');

    useEffect(() => {
        // Fetch version from the deployed app
        fetch(getApiPath('version'))
            .then((response) => response.json())
            .then((data) => {
                if (data.version) {
                    setVersion(data.version);
                }
            })
            .catch((error) => {
                console.error('Error fetching version:', error);
                // Keep default version if fetch fails
            });
    }, []);

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center mb-4">
                    <h2 className="text-2xl font-light">
                        {t('about.title', 'About')}
                    </h2>
                </div>

                <div className="max-w-2xl mx-auto">
                    {/* Logo and Version */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <img
                                src={
                                    isDarkMode
                                        ? '/wide-logo-light.png'
                                        : '/wide-logo-dark.png'
                                }
                                alt="tududi"
                                className="h-16 w-auto"
                            />
                        </div>
                        <p className="text-lg text-gray-600 dark:text-gray-400">
                            {t('about.version', 'Version')} {version}
                        </p>
                    </div>

                    {/* Description */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-8">
                        <p className="text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                            {t(
                                'about.description',
                                'Self-hosted task management with hierarchical organization, multi-language support, and Telegram integration. Built with love for productivity enthusiasts.'
                            )}
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
                            {t(
                                'about.appreciation',
                                'Thank you for using tududi! Your support helps keep this project alive and growing. If you find it useful, consider supporting the development.'
                            )}
                        </p>
                    </div>

                    {/* Support Links */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                            {t(
                                'about.supportDevelopment',
                                'Support Development'
                            )}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <a
                                href="https://www.patreon.com/ChrisVeleris"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors duration-200 font-medium"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M0 .5h4.219v23H0V.5zM15.384.5c4.767 0 8.616 3.718 8.616 8.313 0 4.596-3.85 8.313-8.616 8.313-4.767 0-8.615-3.717-8.615-8.313C6.769 4.218 10.617.5 15.384.5z" />
                                </svg>
                                Patreon
                            </a>
                            <a
                                href="https://coff.ee/chrisveleris"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors duration-200 font-medium"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.766-1.623a4.44 4.44 0 0 0-1.209-.982c-.621-.37-1.294-.646-1.975-.804-.681-.158-1.375-.158-2.056 0-.682.158-1.354.434-1.975.804a4.44 4.44 0 0 0-1.209.982c-.378.46-.647 1.025-.766 1.623l-.132.666a.75.75 0 0 0 .735.885h8.568a.75.75 0 0 0 .735-.885zM11.5 9.5h1v8h-1v-8zM9 9.5h1v8H9v-8zM14 9.5h1v8h-1v-8z" />
                                </svg>
                                Buy Me a Coffee
                            </a>
                            <a
                                href="https://github.com/sponsors/chrisvel"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-800 dark:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg transition-colors duration-200 font-medium"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                                </svg>
                                GitHub Sponsors
                            </a>
                            <a
                                href="https://www.paypal.com/donate/?hosted_button_id=QEQCKLXPB6XAE"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.13-.657c-.55-2.29-2.04-3.26-5.45-3.26H9.326L7.18 15.857h2.19c4.298 0 7.664-1.747 8.647-6.797.03-.149.054-.294.077-.437.206-1.314.064-2.285-.872-2.706z" />
                                </svg>
                                PayPal
                            </a>
                        </div>
                    </div>

                    {/* Community Links */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                            {t('about.community', 'Community')}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <a
                                href="https://tududi.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                Official Website
                            </a>
                            <a
                                href="https://reddit.com/r/tududi"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-medium"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                                </svg>
                                Reddit
                            </a>
                            <a
                                href="https://discord.gg/fkbeJ9CmcH"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 font-medium col-span-2"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z" />
                                </svg>
                                Discord
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
                                <svg
                                    className="w-4 h-4 ml-1"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                            </a>
                            <span className="block text-sm text-gray-500 dark:text-gray-400">
                                {t(
                                    'about.license',
                                    'Licensed for personal use'
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('about.builtBy', 'Built by')}{' '}
                            <a
                                href="https://github.com/chrisvel"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                                Chris Veleris
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
