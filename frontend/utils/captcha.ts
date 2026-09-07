import { getApiPath } from '../config/paths';

export interface CaptchaConfig {
    provider: 'turnstile';
    site_key: string;
}

let cached: Promise<CaptchaConfig | null> | null = null;

// The public config says whether the auth forms must render a captcha and
// with which site key. Fetched once per page load; null means no captcha.
export const fetchCaptchaConfig = (): Promise<CaptchaConfig | null> => {
    if (!cached) {
        cached = fetch(getApiPath('config'), { credentials: 'include' })
            .then(async (response) => {
                if (!response.ok) return null;
                const data = await response.json();
                return data?.captcha?.site_key
                    ? (data.captcha as CaptchaConfig)
                    : null;
            })
            .catch(() => null);
    }
    return cached;
};

export const resetCaptchaConfigCache = () => {
    cached = null;
};
