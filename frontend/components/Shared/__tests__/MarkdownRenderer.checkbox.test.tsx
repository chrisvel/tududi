import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarkdownRenderer from '../MarkdownRenderer';

// Mock react-markdown and its plugins
jest.mock('react-markdown', () => {
    return function ReactMarkdown({ children, components }: any) {
        const content = children as string;
        const lines = content.split('\n');

        return (
            <div className="markdown-content">
                <ul>
                    {lines.map((line: string, idx: number) => {
                        const match = line.match(/^(\s*)-\s*\[([ xX])\](.*)$/);
                        if (match) {
                            const checked = match[2].toLowerCase() === 'x';
                            const text = match[3].trim();
                            const InputComponent = components?.input || 'input';
                            return (
                                <li key={idx}>
                                    <InputComponent
                                        type="checkbox"
                                        checked={checked}
                                    />
                                    {text}
                                </li>
                            );
                        }
                        return <li key={idx}>{line}</li>;
                    })}
                </ul>
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

describe('MarkdownRenderer - Checkbox Functionality', () => {
    it('renders checkboxes for task list items', () => {
        const content = '- [ ] Task one\n- [x] Task two';
        render(<MarkdownRenderer content={content} />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
    });

    it('renders nested checkboxes with proper indentation', () => {
        const content =
            '- [ ] Parent task\n  - [ ] Nested task\n    - [ ] Deep nested task';
        render(<MarkdownRenderer content={content} />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(3);
    });

    it('disables checkboxes when onContentChange is not provided', () => {
        const content = '- [ ] Task one';
        render(<MarkdownRenderer content={content} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeDisabled();
    });

    it('enables checkboxes when onContentChange callback is provided', () => {
        const content = '- [ ] Task one';
        const mockOnContentChange = jest.fn();
        render(
            <MarkdownRenderer
                content={content}
                onContentChange={mockOnContentChange}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeDisabled();
    });

    it('toggles checkbox state when clicked', () => {
        const content = '- [ ] Task one';
        const mockOnContentChange = jest.fn();
        render(
            <MarkdownRenderer
                content={content}
                onContentChange={mockOnContentChange}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        expect(mockOnContentChange).toHaveBeenCalledTimes(1);
        expect(mockOnContentChange).toHaveBeenCalledWith('- [x] Task one');
    });

    it('toggles checked checkbox to unchecked', () => {
        const content = '- [x] Task one';
        const mockOnContentChange = jest.fn();
        render(
            <MarkdownRenderer
                content={content}
                onContentChange={mockOnContentChange}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        expect(mockOnContentChange).toHaveBeenCalledWith('- [ ] Task one');
    });

    it('toggles the correct checkbox in a list', () => {
        const content = '- [ ] Task one\n- [ ] Task two\n- [ ] Task three';
        const mockOnContentChange = jest.fn();
        render(
            <MarkdownRenderer
                content={content}
                onContentChange={mockOnContentChange}
            />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // Click second checkbox

        expect(mockOnContentChange).toHaveBeenCalledWith(
            '- [ ] Task one\n- [x] Task two\n- [ ] Task three'
        );
    });

    it('preserves indentation when toggling nested checkboxes', () => {
        const content = '- [ ] Parent\n  - [ ] Nested';
        const mockOnContentChange = jest.fn();
        render(
            <MarkdownRenderer
                content={content}
                onContentChange={mockOnContentChange}
            />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // Click nested checkbox

        expect(mockOnContentChange).toHaveBeenCalledWith(
            '- [ ] Parent\n  - [x] Nested'
        );
    });
});
