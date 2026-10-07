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
            className={`text-[10px] leading-none text-white/70 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] opacity-60 hover:opacity-100 transition-opacity ${className}`}
            data-testid="photo-credit"
        >
            {t('profile.photoBy', 'Photo by')}{' '}
            <a
                href={photographerUrl(background)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
            >
                {background.photographer}
            </a>{' '}
            {t('profile.photoOn', 'on')}{' '}
            <a
                href={unsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
            >
                Unsplash
            </a>
        </p>
    );
};

export default PhotoCredit;
