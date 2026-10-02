// Matches a GFM task list item: optional blockquote markers, a bullet
// (-, *, +) or ordered (1. / 1)) list marker, then [ ] / [x] followed by
// whitespace or the end of the line.
const TASK_ITEM =
    /^(\s*(?:>\s*)*(?:[-*+]|\d{1,9}[.)])\s+\[)([ xX])(\](?=\s|$).*)$/;
const FENCE = /^\s*(?:>\s*)*(`{3,}|~{3,})/;

// Flips the index-th task list checkbox in the markdown source, counting
// in document order and skipping fenced code blocks (which render no
// checkboxes). Returns the content unchanged when there is no such item.
export const toggleTaskListItem = (content: string, index: number): string => {
    const lines = content.split('\n');
    let fence: string | null = null;
    let current = -1;

    for (let i = 0; i < lines.length; i++) {
        const fenceMatch = lines[i].match(FENCE);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            if (fence === null) {
                fence = marker;
            } else if (
                marker[0] === fence[0] &&
                marker.length >= fence.length
            ) {
                fence = null;
            }
            continue;
        }
        if (fence !== null) continue;

        const match = lines[i].match(TASK_ITEM);
        if (!match) continue;
        current++;
        if (current === index) {
            const next = match[2] === ' ' ? 'x' : ' ';
            lines[i] = `${match[1]}${next}${match[3]}`;
            return lines.join('\n');
        }
    }

    return content;
};
