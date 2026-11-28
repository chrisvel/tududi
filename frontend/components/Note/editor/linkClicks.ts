import { EditorView } from '@codemirror/view';
import { isSafeLinkUrl } from './inlineMarkdown';

export interface LinkClickOptions {
    onOpenWikilink?: (title: string, event: MouseEvent) => void;
}

// A link shown as its text only (caret away from it) opens on a plain
// click, as in Obsidian's live preview. With the caret inside, its syntax
// shows and plain clicks place the caret so it stays editable; Cmd/Ctrl-
// click still follows it. Any link in a note open for reading opens on a
// plain click, since there is no caret to place.
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
            const rendered =
                el.classList.contains('cm-md-wikilink-chip') ||
                el.classList.contains('cm-md-link-rendered');
            if (!modified && !rendered) {
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
