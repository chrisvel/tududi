import React from 'react';
import { useTranslation } from 'react-i18next';

interface OIDCProvider {
    slug: string;
    name: string;
}

interface OIDCProviderButtonsProps {
    providers: OIDCProvider[];
    mode?: 'signIn' | 'signUp';
}

// Google's sign-in branding asks for its own four-colour mark on the button.
const GoogleMark: React.FC = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 48 48"
        aria-hidden="true"
        data-testid="oidc-google-mark"
    >
        <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
    </svg>
);

const OIDCProviderButtons: React.FC<OIDCProviderButtonsProps> = ({
    providers,
    mode = 'signIn',
}) => {
    const { t } = useTranslation();

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
                    data-testid={`oidc-${provider.slug}`}
                >
                    {provider.slug === 'google' && <GoogleMark />}
                    <span>
                        {mode === 'signUp'
                            ? t(
                                  'auth.sign_up_with',
                                  'Sign up with {{provider}}',
                                  {
                                      provider: provider.name,
                                  }
                              )
                            : t(
                                  'auth.sign_in_with',
                                  'Sign in with {{provider}}',
                                  {
                                      provider: provider.name,
                                  }
                              )}
                    </span>
                </button>
            ))}
        </div>
    );
};

export default OIDCProviderButtons;
