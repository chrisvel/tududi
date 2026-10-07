import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarkdownRenderer from '../MarkdownRenderer';

// The mock turns every fenced block in the content into a hast-shaped <pre>
// node and hands it to the renderer's `pre` override, as react-markdown does.
jest.mock('react-markdown', () => {
    return function ReactMarkdown({ children, components }: any) {
        const blocks = [
            ...(children as string).matchAll(/```(\w*)\n([\s\S]*?)```/g),
        ];
        const Pre = components.pre;
        return (
            <div className="markdown-content">
                {blocks.map(([, lang, body], idx) => {
                    const node = {
                        type: 'element',
                        tagName: 'pre',
                        children: [
                            {
                                type: 'element',
                                tagName: 'code',
                                properties: lang
                                    ? { className: [`language-${lang}`] }
                                    : {},
                                children: [{ type: 'text', value: body }],
                            },
                        ],
                    };
                    return (
                        <Pre key={idx} node={node}>
                            <code>{body}</code>
                        </Pre>
                    );
                })}
            </div>
        );
    };
});

jest.mock('remark-gfm', () => ({}));
jest.mock('rehype-highlight', () => ({}));
jest.mock('highlight.js', () => ({
    configure: jest.fn(),
    highlightElement: jest.fn(),
}));
jest.mock('../MermaidDiagram', () => ({
    __esModule: true,
    default: ({ code }: { code: string }) => (
        <div data-testid="mermaid-diagram">{code}</div>
    ),
    getMermaidSource: jest.requireActual('../MermaidDiagram').getMermaidSource,
}));

describe('MarkdownRenderer - Mermaid diagrams', () => {
    const diagram = '```mermaid\ngraph TD\n  A --> B\n```';

    it('renders a mermaid fence as a diagram with its source', () => {
        render(<MarkdownRenderer content={diagram} />);

        expect(screen.getByTestId('mermaid-diagram')).toHaveTextContent(
            'graph TD A --> B'
        );
        expect(screen.queryByLabelText('Copy code')).toBeNull();
    });

    it('keeps other fenced blocks as copyable code blocks', () => {
        render(<MarkdownRenderer content={'```js\nconst a = 1;\n```'} />);

        expect(screen.queryByTestId('mermaid-diagram')).toBeNull();
        expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
    });

    it('keeps fences without a language as code blocks', () => {
        render(<MarkdownRenderer content={'```\nplain\n```'} />);

        expect(screen.queryByTestId('mermaid-diagram')).toBeNull();
        expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
    });

    it('shows a placeholder instead of a diagram in summary mode', () => {
        render(<MarkdownRenderer content={diagram} summaryMode />);

        expect(screen.queryByTestId('mermaid-diagram')).toBeNull();
        expect(
            screen.getByText('[Diagram hidden in preview]')
        ).toBeInTheDocument();
    });
});
