import { EditorView } from '@codemirror/view';
import { isSafeLinkUrl } from './inlineMarkdown';

export interface LinkClickOptions {
    onOpenWikilink?: (title: string) => void;
}

// Plain clicks place the caret (so links stay editable); Cmd/Ctrl-click
// follows them, as in Obsidian.
export const linkClickHandlers = ({ onOpenWikilink }: LinkClickOptions) =>
    EditorView.domEventHandlers({
        mousedown(event) {
            if (!(event.metaKey || event.ctrlKey) || event.button !== 0) {
                return false;
            }
            const target = event.target as HTMLElement | null;
            const el = target?.closest?.('[data-href], [data-wikilink]');
            if (!el) return false;

            const wikilink = el.getAttribute('data-wikilink');
            if (wikilink) {
                event.preventDefault();
                onOpenWikilink?.(wikilink);
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
