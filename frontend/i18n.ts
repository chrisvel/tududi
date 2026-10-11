import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getLocalesPath } from './config/paths';
// LTD-PATCH(T-301): fa locale + document direction without reload
import { applyDocumentDirection } from './utils/direction';

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
            'fa', // LTD-PATCH(T-301)
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
        backend: {
            loadPath: 'locales/{{lng}}/{{ns}}.json',
            queryStringParams: { v: '1' },
            requestOptions: {
                cache: 'default',
                credentials: 'same-origin',
                mode: 'cors',
            },
        },
    })
    .then(() => {
        // LTD-PATCH(T-301): init can emit languageChanged before the listener
        // below is attached, which left <html> without lang/dir after reload.
        applyDocumentDirection(i18n.language);
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

// LTD-PATCH(T-301): set dir/lang for the initially detected language too
i18n.on('initialized', () => {
    applyDocumentDirection(i18n.language);
});
i18n.on('loaded', () => {});
i18n.on('failedLoading', () => {});
i18n.on('missingKey', () => {});

const dispatchLanguageChangeEvent = (lng: string) => {
    const event = new CustomEvent('app-language-changed', {
        detail: { language: lng },
    });
    window.dispatchEvent(event);
};

if (i18n.isInitialized) {
    applyDocumentDirection(i18n.language);
}

i18n.on('languageChanged', (lng) => {
    localStorage.setItem('i18nextLng', lng);
    // LTD-PATCH(T-301): switch dir (fa/ar = rtl) together with lang
    applyDocumentDirection(lng);

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
