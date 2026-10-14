import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AreaDropdown from '../AreaDropdown';
import GoalDropdown from '../GoalDropdown';

// The edit side panel sits at z-[60] and its scrim at z-[55]. Portaled menus
// need the same high layer as the other dropdowns (z-[10050]) or they open
// underneath the panel.
describe('dropdowns inside the entity side panel', () => {
    it('AreaDropdown menu opens above the side panel layer', () => {
        render(
            <AreaDropdown
                value={null}
                onChange={jest.fn()}
                areas={[{ id: 1, uid: 'a1', name: 'Health' } as never]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /No Area/ }));

        const menu = document.querySelector('[data-portal-menu]');
        expect(menu).not.toBeNull();
        expect(menu).toHaveClass('z-[10050]');
    });

    it('GoalDropdown menu opens above the side panel layer', () => {
        render(
            <GoalDropdown
                goalId={null}
                isMaintenance={false}
                goals={[]}
                onChange={jest.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /No goal/ }));

        const menu = document.querySelector('[data-portal-menu]');
        expect(menu).not.toBeNull();
        expect(menu).toHaveClass('z-[10050]');
    });
});
