import { Extension } from '@codemirror/state';
import {
    blockWidgetsField,
    pointerDownField,
    pointerDownHandlers,
} from './blockWidgets';
import { livePreviewPlugin } from './livePreview';
import { livePreviewTheme } from './livePreviewTheme';
import { linkClickHandlers, LinkClickOptions } from './linkClicks';

export const livePreviewExtension = (
    options: LinkClickOptions = {}
): Extension => [
    pointerDownField,
    pointerDownHandlers,
    livePreviewPlugin,
    blockWidgetsField,
    livePreviewTheme,
    linkClickHandlers(options),
];
