import { EditorView } from '@codemirror/view';
import { isSafeLinkUrl } from './inlineMarkdown';

export interface LinkClickOptions {
    onOpenWikilink?: (title: string, event: MouseEvent) => void;
}

// Plain clicks place the caret (so links stay editable); Cmd/Ctrl-click
// follows them, as in Obsidian. A note link shown as a chip (caret away
// from it) also opens on a plain click, and so does any link in a note
// open for reading, where there is no caret to place.
export const linkClickHandlers = ({ onOpenWikilink }: LinkClickOptions) =>
    EditorView.domEventHandlers({
        mousedown(event, view) {
            if (event.button !== 0) return false;
            const target = event.target as HTMLElement | null;
            const el = target?.closest?.('[data-href], [data-wikilink]');
            if (!el) return false;
            const modified =
                event.metaKey ||
                event.ctrlKey ||
                !view.state.facet(EditorView.editable);
            if (!modified && !el.classList.contains('cm-md-wikilink-chip')) {
                return false;
            }

            const wikilink = el.getAttribute('data-wikilink');
            if (wikilink) {
                event.preventDefault();
                onOpenWikilink?.(wikilink, event);
                return true;
            }

            const href = el.getAttribute('data-href') ?? '';
            if (isSafeLinkUrl(href)) {
                event.preventDefault();
                window.open(href, '_blank', 'noopener,noreferrer');
                return true;
            }
            return false;
        },
    });
