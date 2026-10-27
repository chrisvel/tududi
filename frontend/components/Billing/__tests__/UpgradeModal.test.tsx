import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpgradeModal from '../UpgradeModal';
import { broadcastPlanLimit } from '../../../utils/planLimits';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) => {
            const template =
                typeof fallback === 'string'
                    ? fallback
                    : (fallback?.defaultValue ?? key);
            const vars = typeof fallback === 'object' ? fallback : {};
            return Object.keys(vars).reduce(
                (out, name) => out.replace(`{{${name}}}`, String(vars[name])),
                template
            );
        },
    }),
}));

const renderModal = () =>
    render(
        <MemoryRouter>
            <UpgradeModal />
        </MemoryRouter>
    );

const memberLimit = (limit: number, plan: string) =>
    act(() =>
        broadcastPlanLimit({
            code: 'PLAN_LIMIT_REACHED',
            details: { resource: 'member', limit, current: limit, plan },
        } as any)
    );

describe('UpgradeModal', () => {
    it('tells a Pro owner that members come with a Team plan', () => {
        renderModal();
        memberLimit(0, 'pro');

        expect(screen.getByTestId('upgrade-modal')).toHaveTextContent(
            'Pro is for one person. A Team plan lets you add members'
        );
    });

    it('counts the owner among the seats of a full Team plan', () => {
        renderModal();
        memberLimit(4, 'team_5');

        expect(screen.getByTestId('upgrade-modal')).toHaveTextContent(
            'All 5 seats of your plan are in use.'
        );
    });
});
