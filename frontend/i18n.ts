import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getLocalesPath } from './config/paths';

const isDevelopment = process.env.NODE_ENV === 'development';

const fallbackResources = {
    en: {
        translation: {
            common: {
                loading: 'Loading...',
                appLoading: 'Loading application... Please wait.',
                error: 'Error',
            },
            auth: {
                login: 'Login',
                register: 'Register',
            },
            errors: {
                somethingWentWrong: 'Something went wrong, please try again',
            },
        },
    },
};

const devResources = isDevelopment
    ? {
          en: {
              translation: fallbackResources.en.translation,
          },
      }
    : undefined;

// Nothing renders until the first translation file has loaded or failed, so
// a request that stalls (a proxy or a flaky mobile connection) must not leave
// the page blank: give up after a few seconds and fall back to English.
const LOCALE_TIMEOUT_MS = 5000;

const fetchWithTimeout = (
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> => {
    if (typeof AbortController === 'undefined') return fetch(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOCALE_TIMEOUT_MS);
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
    );
};

const i18nInstance = i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next);

i18nInstance
    .init({
        fallbackLng: 'en',
        debug: false,
        load: 'languageOnly',
        supportedLngs: [
            'en',
            'es',
            'el',
            'jp',
            'ua',
            'de',
            'it',
            'fr',
            'ru',
            'tr',
            'ko',
            'vi',
            'ar',
            'nl',
            'ro',
            'zh',
            'pt',
            'id',
            'no',
            'fi',
            'da',
            'sv',
            'pl',
            'bg',
            'sl',
            'sk',
        ],
        nonExplicitSupportedLngs: true,
        resources: devResources,
        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator'],
            lookupQuerystring: 'lng',
            lookupCookie: 'i18next',
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage', 'cookie'],
        },
        interpolation: {
            escapeValue: false,
        },
        defaultNS: 'translation',
        ns: ['translation'],
        // The default (5 retries, doubling from 350ms) holds the page blank
        // for about 11 seconds when the locale files cannot be reached.
        maxRetries: 1,
        backend: {
            loadPath: 'locales/{{lng}}/{{ns}}.json',
            queryStringParams: { v: '2' },
            alternateFetch: fetchWithTimeout,
            requestOptions: {
                cache: 'default',
                credentials: 'same-origin',
                mode: 'cors',
            },
        },
    })
    .then(() => {
        const loadPath = getLocalesPath(`${i18n.language}/translation.json`);

        fetch(loadPath)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch translation: ${response.status}`
                    );
                }
                return response.json();
            })
            .then((data) => {
                i18n.addResourceBundle(
                    i18n.language,
                    'translation',
                    data,
                    true,
                    true
                );
            })
            .catch(() => {
                if (isDevelopment) {
                    try {
                        setTimeout(() => {
                            const retryPath = getLocalesPath(
                                `${i18n.language}/translation.json`
                            );
                            fetch(retryPath, {
                                headers: { Accept: 'application/json' },
                                mode: 'cors',
                            })
                                .then((res) => res.json())
                                .then((data) => {
                                    i18n.addResourceBundle(
                                        i18n.language,
                                        'translation',
                                        data,
                                        true,
                                        true
                                    );
                                })
                                .catch((error) => {
                                    console.error(
                                        'Error loading translation:',
                                        error
                                    );
                                });
                        }, 1000);
                    } catch (e) {
                        console.error('Error in retry mechanism:', e);
                    }
                }
            });
    });

i18n.on('initialized', () => {});
i18n.on('loaded', () => {});
i18n.on('failedLoading', () => {});
i18n.on('missingKey', () => {});

const dispatchLanguageChangeEvent = (lng: string) => {
    const event = new CustomEvent('app-language-changed', {
        detail: { language: lng },
    });
    window.dispatchEvent(event);
};

i18n.on('languageChanged', (lng) => {
    localStorage.setItem('i18nextLng', lng);
    document.documentElement.lang = lng;

    const handleTranslationsLoaded = () => {
        dispatchLanguageChangeEvent(lng);

        if (i18n.services && i18n.services.resourceStore) {
            const currentNS = i18n.options.defaultNS || 'translation';
            i18n.reloadResources(lng, currentNS);
        }
    };

    if (!i18n.hasResourceBundle(lng, 'translation')) {
        const loadPath = getLocalesPath(`${lng}/translation.json`);

        fetch(loadPath)
            .then((response) => response.json())
            .then((data) => {
                if (data) {
                    i18n.addResourceBundle(
                        lng,
                        'translation',
                        data,
                        true,
                        true
                    );
                    handleTranslationsLoaded();
                }
            })
            .catch((error) => {
                console.error('Error loading translations:', error);
                handleTranslationsLoaded();
            });
    } else {
        handleTranslationsLoaded();
    }
});

declare global {
    interface WindowEventMap {
        'app-language-changed': CustomEvent<{ language: string }>;
    }

    interface Window {
        checkTranslation: (key: string) => void;
        forceLanguageReload: (lng?: string) => void;
    }
}

window.checkTranslation = (key: string) => {
    try {
        const translation = i18n.t(key);
        return translation;
    } catch (error) {
        console.error('Error checking translation:', error);
        return null;
    }
};

window.forceLanguageReload = (lng?: string) => {
    const targetLng = lng || i18n.language;

    i18n.reloadResources(targetLng, 'translation')
        .then(() => {
            dispatchLanguageChangeEvent(targetLng);

            if (i18n.services && i18n.services.resourceStore) {
                Object.values(i18n.services.resourceStore.data).forEach(
                    (lang) => {
                        if (
                            lang.translation &&
                            typeof lang.translation === 'object' &&
                            lang.translation !== null
                        ) {
                            const temp = {
                                ...(lang.translation as Record<
                                    string,
                                    unknown
                                >),
                            };
                            lang.translation = temp;
                        }
                    }
                );
            }

            if (lng) {
                setTimeout(() => {
                    i18n.changeLanguage(targetLng);
                }, 50);
            }
        })
        .catch((error) => {
            console.error('Error reloading language:', error);
        });
};

export default i18n;
