// LTD-PATCH(T-301): Apply Life-to-Day identity and quiet shared presentation; preserve behavior.
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { getAssetPath, getApiPath } from '../config/paths';
import { getFeatureFlags } from '../utils/featureFlags';

interface AboutProps {
    isDarkMode?: boolean;
}

const About: React.FC<AboutProps> = ({ isDarkMode = false }) => {
    const { t } = useTranslation();
    const [version, setVersion] = useState<string>('0.3');
    // The page is about the open source project and its donations, which
    // is not what a hosted account is paying for, so hosted sends it home.
    const [hosted, setHosted] = useState(false);

    useEffect(() => {
        getFeatureFlags().then((flags) => setHosted(flags.hosted));
    }, []);

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

    if (hosted) return <Navigate to="/today" replace />;

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-10">
            <h2 className="text-[28px] font-semibold">
                {t('about.title', 'About')}
            </h2>
            <div className="mx-auto max-w-lg py-16 flex flex-col items-center gap-6 text-center">
                <img
                    src={getAssetPath(
                        isDarkMode
                            ? 'life-wordmark-light.png'
                            : 'life-wordmark-dark.png'
                    )}
                    alt="Life-to-Day"
                    className="h-12 w-auto"
                />
                <p className="text-[17px] text-ink">
                    {t('app.tagline', 'From long-term vision to today.')}
                </p>
                <p className="text-sm text-secondary">
                    {t('about.version', 'Version')} {version}
                </p>
                <a
                    href="https://github.com/DanialMasghati/life-to-day"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center text-ink underline underline-offset-4"
                >
                    {t('app.sourceCode', 'Source code')}
                </a>
            </div>
        </div>
    );
};

export default About;
