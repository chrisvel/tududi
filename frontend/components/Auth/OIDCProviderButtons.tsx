import React from 'react';

interface OIDCProvider {
    slug: string;
    name: string;
}

interface OIDCProviderButtonsProps {
    providers: OIDCProvider[];
}

const OIDCProviderButtons: React.FC<OIDCProviderButtonsProps> = ({
    providers,
}) => {
    const handleProviderClick = (slug: string) => {
        window.location.href = `/api/oidc/auth/${slug}`;
    };

    if (providers.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3 mb-6">
            {providers.map((provider) => (
                <button
                    key={provider.slug}
                    onClick={() => handleProviderClick(provider.slug)}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200"
                    type="button"
                >
                    <span>Sign in with {provider.name}</span>
                </button>
            ))}
        </div>
    );
};

export default OIDCProviderButtons;
