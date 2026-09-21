import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MermaidDiagram, { getMermaidSource } from '../MermaidDiagram';

const mockInitialize = jest.fn();
const mockParse = jest.fn();
const mockRender = jest.fn();

jest.mock('mermaid', () => ({
    __esModule: true,
    default: {
        initialize: (...args: unknown[]) => mockInitialize(...args),
        parse: (...args: unknown[]) => mockParse(...args),
        render: (...args: unknown[]) => mockRender(...args),
    },
}));

const codeNode = (className: unknown, ...children: any[]) => ({
    type: 'element',
    tagName: 'code',
    properties: { className },
    children,
});

const preNode = (...children: any[]) => ({
    type: 'element',
    tagName: 'pre',
    children,
});

const text = (value: string) => ({ type: 'text', value });

describe('getMermaidSource', () => {
    it('returns the fenced source for a mermaid code block', () => {
        const node = preNode(
            codeNode(['language-mermaid'], text('graph TD\n  A --> B\n'))
        );
        expect(getMermaidSource(node)).toBe('graph TD\n  A --> B');
    });

    it('joins text split across nested nodes', () => {
        const node = preNode(
            codeNode(['language-mermaid'], text('graph TD\n'), {
                type: 'element',
                tagName: 'span',
                children: [text('A --> B')],
            })
        );
        expect(getMermaidSource(node)).toBe('graph TD\nA --> B');
    });

    it('accepts a string className', () => {
        const node = preNode(codeNode('language-mermaid', text('pie')));
        expect(getMermaidSource(node)).toBe('pie');
    });

    it('returns null for other languages and plain code', () => {
        expect(
            getMermaidSource(preNode(codeNode(['language-js'], text('x'))))
        ).toBeNull();
        expect(
            getMermaidSource(preNode(codeNode(undefined, text('x'))))
        ).toBeNull();
    });

    it('returns null when there is no node or no code child', () => {
        expect(getMermaidSource(undefined)).toBeNull();
        expect(getMermaidSource(preNode(text('x')))).toBeNull();
    });
});

describe('MermaidDiagram', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.documentElement.classList.remove('dark');
        mockParse.mockResolvedValue(true);
        mockRender.mockResolvedValue({
            svg: '<svg data-testid="diagram-svg"></svg>',
        });
    });

    it('renders the svg returned by mermaid', async () => {
        render(<MermaidDiagram code="graph TD; A-->B" />);

        expect(await screen.findByTestId('diagram-svg')).toBeInTheDocument();
        expect(mockParse).toHaveBeenCalledWith('graph TD; A-->B');
        expect(mockRender).toHaveBeenCalledWith(
            expect.stringMatching(/^mermaid-diagram-\d+$/),
            'graph TD; A-->B'
        );
        expect(screen.getByRole('img', { name: 'Mermaid diagram' })).toBe(
            screen.getByTestId('diagram-svg').parentElement
        );
    });

    it('initializes mermaid in strict mode with the light theme', async () => {
        render(<MermaidDiagram code="graph TD; A-->B" />);
        await screen.findByTestId('diagram-svg');

        expect(mockInitialize).toHaveBeenCalledWith(
            expect.objectContaining({
                startOnLoad: false,
                securityLevel: 'strict',
                theme: 'default',
            })
        );
    });

    it('uses the dark theme in dark mode and re-renders when it toggles', async () => {
        document.documentElement.classList.add('dark');
        render(<MermaidDiagram code="graph TD; A-->B" />);
        await screen.findByTestId('diagram-svg');
        expect(mockInitialize).toHaveBeenLastCalledWith(
            expect.objectContaining({ theme: 'dark' })
        );

        await act(async () => {
            document.documentElement.classList.remove('dark');
        });
        await waitFor(() =>
            expect(mockInitialize).toHaveBeenLastCalledWith(
                expect.objectContaining({ theme: 'default' })
            )
        );
    });

    it('re-renders when the source changes', async () => {
        const { rerender } = render(<MermaidDiagram code="graph TD; A-->B" />);
        await screen.findByTestId('diagram-svg');

        rerender(<MermaidDiagram code="graph TD; A-->C" />);
        await waitFor(() =>
            expect(mockRender).toHaveBeenLastCalledWith(
                expect.any(String),
                'graph TD; A-->C'
            )
        );
    });

    it('shows the error and the source when the diagram is invalid', async () => {
        mockParse.mockRejectedValue(new Error('Parse error on line 1'));
        render(<MermaidDiagram code="not a diagram" />);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Could not render Mermaid diagram');
        expect(alert).toHaveTextContent('Parse error on line 1');
        expect(alert).toHaveTextContent('not a diagram');
        expect(mockRender).not.toHaveBeenCalled();
    });

    it('removes the scratch element mermaid leaves behind on failure', async () => {
        mockRender.mockImplementation(async (id: string) => {
            const leftover = document.createElement('div');
            leftover.id = `d${id}`;
            document.body.appendChild(leftover);
            throw new Error('render failed');
        });
        render(<MermaidDiagram code="graph TD; A-->B" />);

        await screen.findByRole('alert');
        expect(document.querySelector('[id^="dmermaid-diagram-"]')).toBeNull();
    });

    it('recovers when the source is fixed after an error', async () => {
        mockParse.mockRejectedValueOnce(new Error('bad'));
        const { rerender } = render(<MermaidDiagram code="oops" />);
        await screen.findByRole('alert');

        rerender(<MermaidDiagram code="graph TD; A-->B" />);
        expect(await screen.findByTestId('diagram-svg')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
