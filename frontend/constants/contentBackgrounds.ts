import { getAssetPath } from '../config/paths';

// Backgrounds a user can pick for the main content area (Profile > Appearance).
// Unsplash photos, served from public/backgrounds rather than the Unsplash CDN
// so showing one sends the viewer's address to nobody else. Every one is
// credited to its photographer wherever it is shown. Each has a 1920px file
// (<id>.webp) and a 320px thumbnail for the pickers (<id>-thumb.webp); `photo`
// is the Unsplash id they were downloaded from.
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
        id: 'painted-color',
        name: 'Painted Color',
        photo: '1541961017774-22349e4a1262',
        photographer: 'Steve A Johnson',
        username: 'steve_j',
    },
    {
        id: 'pastel-strokes',
        name: 'Pastel Strokes',
        photo: '1629194888885-415f67fc9bc7',
        photographer: 'Kseniya Lapteva',
        username: 'ksushlapush',
    },
    {
        id: 'mural',
        name: 'Mural',
        photo: '1552250575-e508473b090f',
        photographer: 'Josep Martins',
        username: 'josepmartins',
    },
    {
        id: 'white-curves',
        name: 'White Curves',
        photo: '1483366774565-c783b9f70e2c',
        photographer: 'Kimon Maritz',
        username: 'kimonmaritz',
    },
    {
        id: 'blue-corner',
        name: 'Blue Corner',
        photo: '1612089889100-bbcf80456e1f',
        photographer: 'Deyan Sight',
        username: 'deyansight',
    },
    {
        id: 'neon-alley',
        name: 'Neon Alley',
        photo: '1561344640-2453889cde5b',
        photographer: 'cheng feng',
        username: 'chengfengrecord',
    },
    {
        id: 'rainy-tokyo',
        name: 'Rainy Tokyo',
        photo: '1601042879364-f3947d3f9c16',
        photographer: 'Valentin BEAUVAIS',
        username: 'valentinbvs',
    },
    {
        id: 'misty-forest',
        name: 'Misty Forest',
        photo: '1543871645-b3be1624a0fc',
        photographer: 'Adrian Infernus',
        username: 'adrian_infernus',
    },
    {
        id: 'blue-ridges',
        name: 'Blue Ridges',
        photo: '1552394459-917cbbffbc84',
        photographer: 'Fabrizio Conti',
        username: 'conti_photos',
    },
    {
        id: 'dusk-sky',
        name: 'Dusk Sky',
        photo: '1554034483-04fda0d3507b',
        photographer: 'Adrian Infernus',
        username: 'adrian_infernus',
    },
    {
        id: 'walnut',
        name: 'Walnut',
        photo: '1576092762791-dd9e2220abd1',
        photographer: 'Nathan Dumlao',
        username: 'nate_dumlao',
    },
    {
        id: 'typewriter',
        name: 'Typewriter',
        photo: '1505682634904-d7c8d95cdc50',
        photographer: 'Patrick Fore',
        username: 'patrickian4',
    },
    {
        id: 'vintage-camera',
        name: 'Vintage Camera',
        photo: '1469355331083-1f22d5a747ae',
        photographer: 'Glenn Carstens-Peters',
        username: 'glenncarstenspeters',
    },
];

// Tint laid over the photo so text that sits straight on the content area
// (headings, task rows) stays readable in both themes.
export const CONTENT_BACKGROUND_OVERLAY = 'bg-gray-300/30 dark:bg-gray-900/50';

const UTM = 'utm_source=tududi&utm_medium=referral';

export const findContentBackground = (
    id: string | null | undefined
): ContentBackground | undefined =>
    id ? CONTENT_BACKGROUNDS.find((bg) => bg.id === id) : undefined;

export const contentBackgroundUrl = (
    bg: ContentBackground,
    size: 'full' | 'thumb' = 'full'
): string =>
    getAssetPath(
        `backgrounds/${bg.id}${size === 'thumb' ? '-thumb' : ''}.webp`
    );

export const photographerUrl = (bg: ContentBackground): string =>
    `https://unsplash.com/@${bg.username}?${UTM}`;

export const unsplashUrl = `https://unsplash.com/?${UTM}`;
