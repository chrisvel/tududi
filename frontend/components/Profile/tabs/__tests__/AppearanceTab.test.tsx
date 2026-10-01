import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppearanceTab from '../AppearanceTab';
import type { ProfileFormData } from '../../types';

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
            showTaskContextMenu={false}
            onToggleTaskContextMenu={jest.fn()}
            contentBackground={contentBackground}
            onContentBackgroundChange={onContentBackgroundChange}
        />
    );
    return { onContentBackgroundChange };
};

describe('AppearanceTab background', () => {
    it('shows no photo or credit when no background is set', () => {
        renderTab(null);

        expect(
            screen.getByTestId('content-background-select')
        ).toHaveTextContent('None');
        const preview = screen.getByTestId('content-background-preview');
        expect(preview.querySelector('img')).toBeNull();
        expect(screen.queryByTestId('photo-credit')).toBeNull();
    });

    it('previews the chosen photo and credits its photographer', () => {
        renderTab('misty-forest');

        const preview = screen.getByTestId('content-background-preview');
        expect(preview.querySelector('img')?.getAttribute('src')).toContain(
            'images.unsplash.com/photo-1543871645-b3be1624a0fc'
        );
        const credit = within(preview).getByTestId('photo-credit');
        const photographer = within(credit).getByRole('link', {
            name: 'Adrian Infernus',
        });
        expect(photographer).toHaveAttribute(
            'href',
            expect.stringContaining('unsplash.com/@adrian_infernus')
        );
        expect(
            within(credit).getByRole('link', { name: 'Unsplash' })
        ).toBeInTheDocument();
    });

    it('reports the picked background, and null for None', () => {
        const { onContentBackgroundChange } = renderTab('misty-forest');

        fireEvent.click(screen.getByTestId('content-background-select'));
        fireEvent.click(screen.getByRole('option', { name: /Blue Ink/ }));
        expect(onContentBackgroundChange).toHaveBeenLastCalledWith('blue-ink');

        fireEvent.click(screen.getByTestId('content-background-select'));
        fireEvent.click(screen.getByRole('option', { name: 'None' }));
        expect(onContentBackgroundChange).toHaveBeenLastCalledWith(null);
    });
});
