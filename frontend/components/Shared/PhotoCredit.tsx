import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ContentBackground,
    photographerUrl,
    unsplashUrl,
} from '../../constants/contentBackgrounds';

interface PhotoCreditProps {
    background: ContentBackground;
    className?: string;
}

const PhotoCredit: React.FC<PhotoCreditProps> = ({
    background,
    className = '',
}) => {
    const { t } = useTranslation();

    return (
        <p
            className={`text-[11px] leading-none rounded-full px-2.5 py-1.5 bg-black/40 text-white/90 backdrop-blur-sm ${className}`}
            data-testid="photo-credit"
        >
            {t('profile.photoBy', 'Photo by')}{' '}
            <a
                href={photographerUrl(background)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-2 hover:underline"
            >
                {background.photographer}
            </a>{' '}
            {t('profile.photoOn', 'on')}{' '}
            <a
                href={unsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-2 hover:underline"
            >
                Unsplash
            </a>
        </p>
    );
};

export default PhotoCredit;
