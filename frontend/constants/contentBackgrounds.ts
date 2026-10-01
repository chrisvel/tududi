// Backgrounds a user can pick for the main content area (Profile > Appearance).
// Photos are hotlinked from the Unsplash CDN, as the Unsplash guidelines ask,
// and every one is credited to its photographer wherever it is shown.
export type ContentBackgroundCategory =
    'abstract' | 'artistic' | 'modern' | 'cyberpunk' | 'scenery' | 'objects';

export interface ContentBackground {
    id: string;
    name: string;
    category: ContentBackgroundCategory;
    photo: string;
    photographer: string;
    username: string;
}

export const CONTENT_BACKGROUND_CATEGORIES: {
    id: ContentBackgroundCategory;
    name: string;
}[] = [
    { id: 'abstract', name: 'Abstract' },
    { id: 'artistic', name: 'Artistic' },
    { id: 'modern', name: 'Modern' },
    { id: 'cyberpunk', name: 'Cyberpunk' },
    { id: 'scenery', name: 'Scenery' },
    { id: 'objects', name: 'Objects' },
];

export const CONTENT_BACKGROUNDS: ContentBackground[] = [
    {
        id: 'blue-ink',
        name: 'Blue Ink',
        category: 'abstract',
        photo: '1604871000636-074fa5117945',
        photographer: 'Pawel Czerwinski',
        username: 'pawel_czerwinski',
    },
    {
        id: 'aurora-gradient',
        name: 'Aurora Gradient',
        category: 'abstract',
        photo: '1579546929518-9e396f3cc809',
        photographer: 'Codioful (Formerly Gradienta)',
        username: 'codioful',
    },
    {
        id: 'violet-glow',
        name: 'Violet Glow',
        category: 'abstract',
        photo: '1635776062127-d379bfcba9f8',
        photographer: 'MagicPattern',
        username: 'magicpattern',
    },
    {
        id: 'painted-color',
        name: 'Painted Color',
        category: 'artistic',
        photo: '1541961017774-22349e4a1262',
        photographer: 'Steve A Johnson',
        username: 'steve_j',
    },
    {
        id: 'pastel-strokes',
        name: 'Pastel Strokes',
        category: 'artistic',
        photo: '1629194888885-415f67fc9bc7',
        photographer: 'Kseniya Lapteva',
        username: 'ksushlapush',
    },
    {
        id: 'mural',
        name: 'Mural',
        category: 'artistic',
        photo: '1552250575-e508473b090f',
        photographer: 'Josep Martins',
        username: 'josepmartins',
    },
    {
        id: 'white-curves',
        name: 'White Curves',
        category: 'modern',
        photo: '1483366774565-c783b9f70e2c',
        photographer: 'Kimon Maritz',
        username: 'kimonmaritz',
    },
    {
        id: 'blue-corner',
        name: 'Blue Corner',
        category: 'modern',
        photo: '1612089889100-bbcf80456e1f',
        photographer: 'Deyan Sight',
        username: 'deyansight',
    },
    {
        id: 'neon-alley',
        name: 'Neon Alley',
        category: 'cyberpunk',
        photo: '1561344640-2453889cde5b',
        photographer: 'cheng feng',
        username: 'chengfengrecord',
    },
    {
        id: 'rainy-tokyo',
        name: 'Rainy Tokyo',
        category: 'cyberpunk',
        photo: '1601042879364-f3947d3f9c16',
        photographer: 'Valentin BEAUVAIS',
        username: 'valentinbvs',
    },
    {
        id: 'misty-forest',
        name: 'Misty Forest',
        category: 'scenery',
        photo: '1543871645-b3be1624a0fc',
        photographer: 'Adrian Infernus',
        username: 'adrian_infernus',
    },
    {
        id: 'blue-ridges',
        name: 'Blue Ridges',
        category: 'scenery',
        photo: '1552394459-917cbbffbc84',
        photographer: 'Fabrizio Conti',
        username: 'conti_photos',
    },
    {
        id: 'dusk-sky',
        name: 'Dusk Sky',
        category: 'scenery',
        photo: '1554034483-04fda0d3507b',
        photographer: 'Adrian Infernus',
        username: 'adrian_infernus',
    },
    {
        id: 'walnut',
        name: 'Walnut',
        category: 'objects',
        photo: '1576092762791-dd9e2220abd1',
        photographer: 'Nathan Dumlao',
        username: 'nate_dumlao',
    },
    {
        id: 'typewriter',
        name: 'Typewriter',
        category: 'objects',
        photo: '1505682634904-d7c8d95cdc50',
        photographer: 'Patrick Fore',
        username: 'patrickian4',
    },
    {
        id: 'vintage-camera',
        name: 'Vintage Camera',
        category: 'objects',
        photo: '1469355331083-1f22d5a747ae',
        photographer: 'Glenn Carstens-Peters',
        username: 'glenncarstenspeters',
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
