import { detectCallout } from '../calloutParser';

const text = (value: string) => ({ type: 'text', value });
const paragraph = (...children: any[]) => ({
    type: 'element',
    tagName: 'p',
    children,
});
const blockquote = (...children: any[]) => ({
    type: 'element',
    tagName: 'blockquote',
    children,
});

describe('detectCallout', () => {
    it('detects a callout when a whitespace text node precedes the paragraph', () => {
        const node = blockquote(
            text('\n'),
            paragraph(text('[!NOTE]')),
            text('\n'),
            paragraph(text('Body text.')),
            text('\n')
        );

        expect(detectCallout(node)).toEqual({
            type: 'NOTE',
            title: undefined,
            remainderText: '',
        });
    });

    it('detects a callout when the paragraph is the first child', () => {
        const node = blockquote(paragraph(text('[!WARNING]')));

        expect(detectCallout(node)).toMatchObject({ type: 'WARNING' });
    });

    it('extracts the title from the marker line', () => {
        const node = blockquote(
            text('\n'),
            paragraph(text('[!WARNING] Watch out'))
        );

        expect(detectCallout(node)).toEqual({
            type: 'WARNING',
            title: 'Watch out',
            remainderText: '',
        });
    });

    it('keeps soft-wrapped lines after the marker as remainder text', () => {
        const node = blockquote(
            text('\n'),
            paragraph(text('[!NOTE]\nline one\nline two'))
        );

        expect(detectCallout(node)).toEqual({
            type: 'NOTE',
            title: undefined,
            remainderText: 'line one\nline two',
        });
    });

    it('separates a same-line title from soft-wrapped body lines', () => {
        const node = blockquote(
            text('\n'),
            paragraph(text('[!TIP] My title\nbody line'))
        );

        expect(detectCallout(node)).toEqual({
            type: 'TIP',
            title: 'My title',
            remainderText: 'body line',
        });
    });

    it('matches markers case-insensitively and normalizes the type', () => {
        const node = blockquote(text('\n'), paragraph(text('[!important]')));

        expect(detectCallout(node)).toMatchObject({ type: 'IMPORTANT' });
    });

    it('returns null for a plain blockquote', () => {
        const node = blockquote(text('\n'), paragraph(text('just a quote')));

        expect(detectCallout(node)).toBeNull();
    });

    it('returns null for unknown callout types', () => {
        const node = blockquote(text('\n'), paragraph(text('[!FOO]\nbody')));

        expect(detectCallout(node)).toBeNull();
    });

    it('returns null when the first element is not a paragraph', () => {
        const node = blockquote(text('\n'), {
            type: 'element',
            tagName: 'ul',
            children: [],
        });

        expect(detectCallout(node)).toBeNull();
    });

    it('returns null when the paragraph starts with a non-text node', () => {
        const node = blockquote(
            text('\n'),
            paragraph({
                type: 'element',
                tagName: 'strong',
                children: [text('[!NOTE]')],
            })
        );

        expect(detectCallout(node)).toBeNull();
    });

    it('returns null for empty or missing nodes', () => {
        expect(detectCallout(undefined)).toBeNull();
        expect(detectCallout(blockquote())).toBeNull();
    });
});
