import { Extension } from '@codemirror/state';
import { blockWidgetsField } from './blockWidgets';
import { livePreviewPlugin } from './livePreview';
import { livePreviewTheme } from './livePreviewTheme';
import { linkClickHandlers, LinkClickOptions } from './linkClicks';

export const livePreviewExtension = (
    options: LinkClickOptions = {}
): Extension => [
    livePreviewPlugin,
    blockWidgetsField,
    livePreviewTheme,
    linkClickHandlers(options),
];
