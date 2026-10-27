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

const renderTab = (
    contentBackground: string | null,
    props: Partial<React.ComponentProps<typeof AppearanceTab>> = {}
) => {
    const onContentBackgroundChange = jest.fn();
    const onAccentChange = jest.fn();
    render(
        <AppearanceTab
            isActive
            formData={{ appearance: 'light' } as ProfileFormData}
            onAppearanceChange={jest.fn()}
            contentBackground={contentBackground}
            onContentBackgroundChange={onContentBackgroundChange}
            accent={null}
            onAccentChange={onAccentChange}
            {...props}
        />
    );
    return { onContentBackgroundChange, onAccentChange };
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

describe('AppearanceTab accent colour', () => {
    it('offers the accent colours', () => {
        renderTab(null);

        expect(screen.getByText('Accent colour')).toBeInTheDocument();
        expect(screen.getByTestId('accent-swatches')).toBeInTheDocument();
        expect(screen.getByLabelText('Red')).toBeInTheDocument();
        expect(screen.getByLabelText('Default')).toBeInTheDocument();
    });

    it('reports the picked accent colour', () => {
        const { onAccentChange } = renderTab(null);

        fireEvent.click(screen.getByLabelText('Teal'));

        expect(onAccentChange).toHaveBeenLastCalledWith('#0f766e');
    });

    it('marks the chosen accent colour as pressed', () => {
        renderTab(null, { accent: '#0f766e' });

        expect(screen.getByLabelText('Teal')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByLabelText('Red')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        expect(screen.getByLabelText('Default')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('falls back to the default accent colour', () => {
        const { onAccentChange } = renderTab(null, { accent: '#0f766e' });

        fireEvent.click(screen.getByLabelText('Default'));

        expect(onAccentChange).toHaveBeenLastCalledWith(null);
    });

    it('shows an accent colour that is not one of the offered ones', () => {
        renderTab(null, { accent: '#123456' });

        expect(screen.getByLabelText('#123456')).toBeInTheDocument();
    });
});
