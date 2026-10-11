import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LtdNav from '../LtdNav';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

const renderNav = (path = '/today') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <LtdNav />
        </MemoryRouter>
    );

describe('LtdNav shortcuts', () => {
    beforeEach(() => mockNavigate.mockClear());

    it('navigates on T / P / G / L / I / R', () => {
        renderNav();
        fireEvent.keyDown(window, { key: 'g' });
        expect(mockNavigate).toHaveBeenCalledWith('/goals');
        fireEvent.keyDown(window, { key: 'i' });
        expect(mockNavigate).toHaveBeenCalledWith('/inbox');
    });

    it('does not fire while typing in an input', () => {
        renderNav();
        const input = document.createElement('input');
        document.body.appendChild(input);
        fireEvent.keyDown(input, { key: 't' });
        expect(mockNavigate).not.toHaveBeenCalled();
        document.body.removeChild(input);
    });

    it('does not fire in a textarea or contenteditable', () => {
        renderNav();
        const area = document.createElement('textarea');
        document.body.appendChild(area);
        fireEvent.keyDown(area, { key: 'p' });
        expect(mockNavigate).not.toHaveBeenCalled();
        document.body.removeChild(area);

        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        document.body.appendChild(editable);
        fireEvent.keyDown(editable, { key: 'g' });
        expect(mockNavigate).not.toHaveBeenCalled();
        document.body.removeChild(editable);
    });
});

// LTD-PATCH(T-406): week and day belong to one accessible Plan navigation destination.
it('marks Plan active while weekly priorities are visible', () => {
    const { getByTestId } = renderNav('/plan/week');
    expect(getByTestId('ltd-nav-plan')).toHaveAttribute('aria-current', 'page');
    expect(getByTestId('ltd-nav-mobile-plan')).toHaveAttribute(
        'aria-current',
        'page'
    );
});
