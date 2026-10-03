import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppearanceTab from '../AppearanceTab';
import type { ProfileFormData } from '../../types';
import { CONTENT_BACKGROUNDS } from '../../../../constants/contentBackgrounds';

jest.mock('react-i18next', () => {
    const t = (key: string, fallback?: any) =>
        typeof fallback === 'string' ? fallback : key;
    const value = { t };
    return { useTranslation: () => value };
});

const renderTab = (contentBackground: string | null) => {
    const onContentBackgroundChange = jest.fn();
    render(
        <AppearanceTab
            isActive
            formData={{ appearance: 'light' } as ProfileFormData}
            onAppearanceChange={jest.fn()}
            contentBackground={contentBackground}
            onContentBackgroundChange={onContentBackgroundChange}
        />
    );
    return { onContentBackgroundChange };
};

const cards = () =>
    within(screen.getByTestId('content-background-cards')).getAllByRole(
        'button'
    );

describe('AppearanceTab background', () => {
    it('shows a card for None and for every photo, with None selected by default', () => {
        renderTab(null);

        expect(cards()).toHaveLength(CONTENT_BACKGROUNDS.length + 1);
        expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('shows each photo with its photographer and marks the chosen one', () => {
        renderTab('misty-forest');

        const card = screen.getByRole('button', { name: /Misty Forest/ });
        expect(card).toHaveAttribute('aria-pressed', 'true');
        expect(card).toHaveTextContent('Adrian Infernus');
        expect(card.querySelector('img')?.getAttribute('src')).toContain(
            'backgrounds/misty-forest-thumb.webp'
        );
        expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('reports the picked background, and null for None', () => {
        const { onContentBackgroundChange } = renderTab('misty-forest');

        fireEvent.click(screen.getByRole('button', { name: /Blue Ink/ }));
        expect(onContentBackgroundChange).toHaveBeenLastCalledWith('blue-ink');

        fireEvent.click(screen.getByRole('button', { name: 'None' }));
        expect(onContentBackgroundChange).toHaveBeenLastCalledWith(null);
    });
});
