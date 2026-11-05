import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import MarkdownRenderer from '../MarkdownRenderer';

// Renders image syntax through the component's own img override.
jest.mock('react-markdown', () => {
    return function ReactMarkdown({ children, components }: any) {
        const match = (children as string).match(/!\[([^\]]*)\]\(([^)]+)\)/);
        const Img = components?.img || 'img';
        return (
            <div className="markdown-content">
                {match && <Img alt={match[1]} src={match[2]} />}
            </div>
        );
    };
});
jest.mock('remark-gfm', () => ({}));
jest.mock('rehype-highlight', () => ({}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('../../../store/useStore', () => {
    const state = { notesStore: { notes: [] } };
    return {
        useStore: (selector: (s: typeof state) => unknown) => selector(state),
    };
});

describe('MarkdownRenderer videos', () => {
    const renderContent = (content: string) =>
        render(
            <MemoryRouter>
                <MarkdownRenderer content={content} />
            </MemoryRouter>
        );

    it('plays an mp4 written as an image', () => {
        const { container } = renderContent(
            '![Walkthrough](/api/public/notes/tok/files/walkthrough.mp4)'
        );
        const video = container.querySelector('video');
        expect(video).toHaveAttribute(
            'src',
            '/api/public/notes/tok/files/walkthrough.mp4'
        );
        expect(video).toHaveAttribute('controls');
        expect(video).toHaveAttribute('aria-label', 'Walkthrough');
        expect(container.querySelector('img')).toBeNull();
    });

    it('still shows a picture as an image', () => {
        const { container } = renderContent('![Board](/files/board.png)');
        expect(container.querySelector('img')).toHaveAttribute(
            'src',
            '/files/board.png'
        );
        expect(container.querySelector('video')).toBeNull();
    });
});
