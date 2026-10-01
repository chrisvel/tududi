// Backgrounds a user can pick for the main content area (Profile > Appearance).
// Photos are hotlinked from the Unsplash CDN, as the Unsplash guidelines ask,
// and every one is credited to its photographer wherever it is shown.
export interface ContentBackground {
    id: string;
    name: string;
    photo: string;
    photographer: string;
    username: string;
}

export const CONTENT_BACKGROUNDS: ContentBackground[] = [
    {
        id: 'blue-ink',
        name: 'Blue Ink',
        photo: '1604871000636-074fa5117945',
        photographer: 'Pawel Czerwinski',
        username: 'pawel_czerwinski',
    },
    {
        id: 'painted-color',
        name: 'Painted Color',
        photo: '1541961017774-22349e4a1262',
        photographer: 'Steve A Johnson',
        username: 'steve_j',
    },
    {
        id: 'mural',
        name: 'Mural',
        photo: '1552250575-e508473b090f',
        photographer: 'Josep Martins',
        username: 'josepmartins',
    },
    {
        id: 'pastel-strokes',
        name: 'Pastel Strokes',
        photo: '1629194888885-415f67fc9bc7',
        photographer: 'Kseniya Lapteva',
        username: 'ksushlapush',
    },
    {
        id: 'aurora-gradient',
        name: 'Aurora Gradient',
        photo: '1579546929518-9e396f3cc809',
        photographer: 'Codioful (Formerly Gradienta)',
        username: 'codioful',
    },
    {
        id: 'violet-glow',
        name: 'Violet Glow',
        photo: '1635776062127-d379bfcba9f8',
        photographer: 'MagicPattern',
        username: 'magicpattern',
    },
    {
        id: 'morning-haze',
        name: 'Morning Haze',
        photo: '1635776062043-223faf322554',
        photographer: 'MagicPattern',
        username: 'magicpattern',
    },
    {
        id: 'dusk-sky',
        name: 'Dusk Sky',
        photo: '1554034483-04fda0d3507b',
        photographer: 'Adrian Infernus',
        username: 'adrian_infernus',
    },
    {
        id: 'misty-forest',
        name: 'Misty Forest',
        photo: '1543871645-b3be1624a0fc',
        photographer: 'Adrian Infernus',
        username: 'adrian_infernus',
    },
    {
        id: 'mountain-fog',
        name: 'Mountain Fog',
        photo: '1504252060324-1c76e2e09939',
        photographer: 'Vincent Guth',
        username: 'vingtcent',
    },
    {
        id: 'blue-ridges',
        name: 'Blue Ridges',
        photo: '1552394459-917cbbffbc84',
        photographer: 'Fabrizio Conti',
        username: 'conti_photos',
    },
    {
        id: 'night-waves',
        name: 'Night Waves',
        photo: '1612623753207-96465febeee7',
        photographer: 'Adam Kring',
        username: 'adamkring',
    },
];

// Tint laid over the photo so text that sits straight on the content area
// (headings, task rows) stays readable in both themes.
export const CONTENT_BACKGROUND_OVERLAY = 'bg-gray-100/55 dark:bg-gray-900/75';

const UTM = 'utm_source=tududi&utm_medium=referral';

export const findContentBackground = (
    id: string | null | undefined
): ContentBackground | undefined =>
    id ? CONTENT_BACKGROUNDS.find((bg) => bg.id === id) : undefined;

export const contentBackgroundUrl = (
    bg: ContentBackground,
    width = 2400
): string =>
    `https://images.unsplash.com/photo-${bg.photo}?auto=format&fit=crop&w=${width}&q=80`;

export const photographerUrl = (bg: ContentBackground): string =>
    `https://unsplash.com/@${bg.username}?${UTM}`;

export const unsplashUrl = `https://unsplash.com/?${UTM}`;
