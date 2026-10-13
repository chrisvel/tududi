import { toggleTaskListItem } from '../markdownTaskList';

describe('toggleTaskListItem', () => {
    it('checks and unchecks a dash item', () => {
        expect(toggleTaskListItem('- [ ] milk', 0)).toBe('- [x] milk');
        expect(toggleTaskListItem('- [x] milk', 0)).toBe('- [ ] milk');
        expect(toggleTaskListItem('- [X] milk', 0)).toBe('- [ ] milk');
    });

    it('handles star, plus and ordered list markers', () => {
        const content = '- [ ] a\n* [ ] b\n+ [ ] c\n1. [ ] d\n2) [ ] e';
        expect(toggleTaskListItem(content, 1)).toBe(
            '- [ ] a\n* [x] b\n+ [ ] c\n1. [ ] d\n2) [ ] e'
        );
        expect(toggleTaskListItem(content, 3)).toBe(
            '- [ ] a\n* [ ] b\n+ [ ] c\n1. [x] d\n2) [ ] e'
        );
        expect(toggleTaskListItem(content, 4)).toBe(
            '- [ ] a\n* [ ] b\n+ [ ] c\n1. [ ] d\n2) [x] e'
        );
    });

    it('keeps indentation and blockquote prefixes', () => {
        expect(toggleTaskListItem('- [ ] a\n    - [ ] b', 1)).toBe(
            '- [ ] a\n    - [x] b'
        );
        expect(toggleTaskListItem('> - [ ] quoted', 0)).toBe('> - [x] quoted');
    });

    it('skips items inside fenced code blocks', () => {
        const content = '```\n- [ ] not a task\n```\n- [ ] real';
        expect(toggleTaskListItem(content, 0)).toBe(
            '```\n- [ ] not a task\n```\n- [x] real'
        );
    });

    it('ignores text that is not a task list item', () => {
        const content = '-[ ] no space\n- [ ]no space after\n- [ ] real';
        expect(toggleTaskListItem(content, 0)).toBe(
            '-[ ] no space\n- [ ]no space after\n- [x] real'
        );
    });

    it('returns the content unchanged for an out-of-range index', () => {
        expect(toggleTaskListItem('- [ ] a', 3)).toBe('- [ ] a');
    });
});
