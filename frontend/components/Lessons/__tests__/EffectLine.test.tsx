import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SWRConfig } from 'swr';
import EffectLine from '../EffectLine';
import { fetchTaskEffect, TaskEffect } from '../../../utils/lessonsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'en' },
        t: (key: string, a?: unknown) => {
            const options = (typeof a === 'object' ? a : {}) as Record<
                string,
                string
            >;
            const text =
                typeof a === 'string' ? a : (options.defaultValue ?? key);
            return text.replace(/{{(\w+)}}/g, (_, n) => options[n] ?? '');
        },
    }),
}));
jest.mock('../../../utils/lessonsService', () => ({
    ...jest.requireActual('../../../utils/lessonsService'),
    fetchTaskEffect: jest.fn(),
}));

const linked: TaskEffect = {
    task_uid: 't1',
    kind: 'linked',
    chain: [
        {
            uid: 'g2',
            title: 'Work in Spanish',
            horizon: 'five_year',
            why: 'Choose',
        },
    ],
    fiveYear: {
        uid: 'g2',
        title: 'Work in Spanish',
        horizon: 'five_year',
        why: 'Choose',
    },
    vision: null,
    meaning: 'Choose where I work',
    outcome: {
        goal_uid: 'g2',
        title: 'Work in Spanish',
        horizon: 'five_year',
        value: 0.4,
    },
    activity: true,
    lesson: {
        uid: 'l1',
        title: 'Short sessions',
        if_text: 'I sit down',
        then_text: 'I set a timer',
        review_on: null,
    },
};
const renderLine = (effect: TaskEffect, expandable = true) => {
    (fetchTaskEffect as jest.Mock).mockResolvedValue(effect);
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <EffectLine taskUid="t1" expandable={expandable} />
        </SWRConfig>
    );
};

describe('EffectLine (Now and Focus)', () => {
    it('shows one path line and one lesson line; percent and why wait behind More', async () => {
        renderLine(linked);
        expect(await screen.findByTestId('effect-path')).toHaveTextContent(
            'This task is on the path “Work in Spanish”.'
        );
        expect(screen.getByTestId('effect-lesson')).toHaveTextContent(
            'If I sit down, then I set a timer.'
        );
        expect(screen.queryByText(/40%/)).toBeNull();
        fireEvent.click(screen.getByTestId('effect-more'));
        expect(screen.getByTestId('effect-outcome')).toHaveTextContent('40%');
        expect(screen.getByText(/Choose where I work/)).toBeInTheDocument();
    });

    it('in Focus there is no More, and an unlinked task has no percent', async () => {
        renderLine(
            {
                ...linked,
                kind: 'unlinked',
                chain: [],
                fiveYear: null,
                meaning: null,
                outcome: null,
                lesson: null,
            },
            false
        );
        expect(await screen.findByTestId('effect-path')).toHaveTextContent(
            'This task is not linked to a goal yet.'
        );
        expect(screen.queryByTestId('effect-more')).toBeNull();
        expect(screen.queryByTestId('effect-lesson')).toBeNull();
        expect(screen.queryByText(/%/)).toBeNull();
    });
});
