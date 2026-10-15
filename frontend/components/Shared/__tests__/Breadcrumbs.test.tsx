import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '../Breadcrumbs';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Breadcrumbs />
        </MemoryRouter>
    );

describe('Breadcrumbs', () => {
    it('links a group page back to Everyone', () => {
        renderAt('/groups/g1');
        expect(screen.getByRole('link', { name: 'Everyone' })).toHaveAttribute(
            'href',
            '/everyone'
        );
        expect(screen.getByText('Group')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('renders nothing on the Everyone page itself', () => {
        const { container } = renderAt('/everyone');
        expect(container).toBeEmptyDOMElement();
    });
});
