import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { lessonLine, outcomeLine, pathLine } from '../effectText';
import { TaskEffect } from '../../../utils/lessonsService';

// Life-to-Day (T-1103): the effect sentences. A percent appears only for a
// measured outcome, never for the task itself.
const t = ((key: string, a?: unknown, b?: unknown) => {
    const options = (typeof a === 'object' ? a : b) as
        Record<string, string> | undefined;
    const text = typeof a === 'string' ? a : (options?.defaultValue ?? key);
    return text.replace(/{{(\w+)}}/g, (_, name) => options?.[name] ?? '');
}) as any;

// The text a sentence renders; user text sits in <bdi>.
const plain = (node: React.ReactNode) =>
    node === null ? null : render(<>{node}</>).container.textContent;

const node = (uid: string, horizon: string, title = uid) => ({
    uid,
    title,
    horizon,
    why: null,
});
const effect = (changes: Partial<TaskEffect> = {}): TaskEffect => ({
    task_uid: 't1',
    kind: 'linked',
    chain: [node('g3', 'year', 'Spanish B1')],
    fiveYear: null,
    vision: null,
    meaning: null,
    outcome: null,
    activity: true,
    lesson: null,
    ...changes,
});

describe('effect sentences', () => {
    it('names the five-year path first, then the vision, then the farthest goal', () => {
        const five = node('g2', 'five_year', 'Work in Spanish');
        const vision = node('g1', 'vision', 'A bilingual life');
        expect(plain(pathLine(effect({ fiveYear: five, vision }), t))).toBe(
            'This task is on the path “Work in Spanish”.'
        );
        expect(plain(pathLine(effect({ vision }), t))).toBe(
            'This task is linked to “A bilingual life”.'
        );
        expect(plain(pathLine(effect(), t))).toBe(
            'This task is linked to “Spanish B1”.'
        );
        expect(
            plain(pathLine(effect({ kind: 'unlinked', chain: [] }), t))
        ).toBe('This task is not linked to a goal yet.');
    });

    it('shows round(value × 100) for the outcome and no percent otherwise', () => {
        const measured = effect({
            outcome: {
                goal_uid: 'g3',
                title: 'Spanish B1',
                horizon: 'year',
                value: 0.404,
            },
        });
        expect(plain(outcomeLine(measured, t, 'en'))).toBe(
            'The outcome “Spanish B1” is now 40%. Doing the task is activity. The outcome changes when a metric is recorded.'
        );
        expect(plain(outcomeLine(effect(), t, 'en'))).toBe(
            'No metric has been recorded for this path.'
        );
        expect(
            outcomeLine(effect({ kind: 'unlinked', chain: [] }), t, 'en')
        ).toBeNull();
        // A goal title keeps its own direction inside the sentence.
        const { container } = render(<>{outcomeLine(measured, t, 'en')}</>);
        expect(container.querySelector('bdi')).toHaveTextContent('Spanish B1');
    });

    it('uses the if/then of a lesson, else its title', () => {
        const lesson = {
            uid: 'l1',
            title: 'Short sessions',
            if_text: 'I sit down to study',
            then_text: 'I set a timer',
            review_on: null,
        };
        expect(plain(lessonLine(lesson, t))).toBe(
            'If I sit down to study, then I set a timer.'
        );
        expect(plain(lessonLine({ ...lesson, if_text: null }, t))).toBe(
            'Short sessions'
        );
    });
});
