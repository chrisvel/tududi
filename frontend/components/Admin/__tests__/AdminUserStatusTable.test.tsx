import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminUserStatusTable from '../AdminUserStatusTable';

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

const user = (overrides: Record<string, unknown>) => ({
    id: 1,
    email: 'a@example.com',
    name: null,
    created_at: '2026-10-01T10:00:00.000Z',
    email_verified: true,
    account_status: 'active',
    is_admin: false,
    member_of: null,
    access: 'free',
    trial_ends_at: null,
    trial_days_left: null,
    read_only_until: null,
    paid: false,
    subscription_status: null,
    ever_paid: false,
    usage: { total: 0, counts: {}, last_created_at: null },
    ...overrides,
});

const users = [
    user({
        id: 1,
        email: 'trial@example.com',
        access: 'trial',
        trial_days_left: 9,
        created_at: '2026-10-03T10:00:00.000Z',
    }),
    user({
        id: 2,
        email: 'paying@example.com',
        access: 'subscription',
        paid: true,
        ever_paid: true,
        created_at: '2026-09-01T10:00:00.000Z',
        usage: {
            total: 12,
            counts: { tasks: 9, projects: 2, tags: 1 },
            last_created_at: '2026-10-06T10:00:00.000Z',
        },
    }),
    user({
        id: 3,
        email: 'new@example.com',
        email_verified: false,
        access: 'trial',
        trial_days_left: 2,
        created_at: '2026-10-05T10:00:00.000Z',
    }),
];

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ hosted: true, users }),
    }) as any;
});

const emails = () =>
    screen
        .getAllByTestId(/^admin-user-status-/)
        .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('Admin user status table', () => {
    it('shows trial, days left, verification and payment', async () => {
        render(<AdminUserStatusTable />);
        expect(
            await screen.findByTestId('admin-user-access-1')
        ).toHaveTextContent('Trial');
        expect(screen.getByTestId('admin-user-days-1')).toHaveTextContent('9');
        expect(screen.getByTestId('admin-user-paid-2')).toHaveTextContent(
            'Yes'
        );
        expect(screen.getByTestId('admin-user-paid-1')).toHaveTextContent('No');
        expect(
            within(screen.getByTestId('admin-user-status-3')).getByText(
                'Not verified'
            )
        ).toBeInTheDocument();
    });

    it('lists newest sign-ups first and sorts by a clicked column', async () => {
        render(<AdminUserStatusTable />);
        await screen.findByTestId('admin-user-access-1');
        expect(emails()).toEqual([
            'new@example.com',
            'trial@example.com',
            'paying@example.com',
        ]);

        // Days left ascending, rows without a trial last
        fireEvent.click(screen.getByTestId('sort-daysLeft'));
        expect(emails()).toEqual([
            'new@example.com',
            'trial@example.com',
            'paying@example.com',
        ]);
        fireEvent.click(screen.getByTestId('sort-daysLeft'));
        expect(emails()).toEqual([
            'trial@example.com',
            'new@example.com',
            'paying@example.com',
        ]);

        fireEvent.click(screen.getByTestId('sort-user'));
        expect(emails()).toEqual([
            'new@example.com',
            'paying@example.com',
            'trial@example.com',
        ]);
    });

    it('filters by several choices, widening within a group and narrowing across', async () => {
        render(<AdminUserStatusTable />);
        await screen.findByTestId('admin-user-access-1');

        fireEvent.click(screen.getByTestId('admin-user-filter'));
        fireEvent.click(screen.getByTestId('admin-user-filter-verified'));
        expect(emails()).toEqual(['trial@example.com', 'paying@example.com']);

        fireEvent.click(screen.getByTestId('admin-user-filter-paid'));
        expect(emails()).toEqual(['paying@example.com']);
        expect(screen.getByTestId('admin-user-filter-count')).toHaveTextContent(
            '1 of 3'
        );

        fireEvent.click(screen.getByTestId('admin-user-filter-trial'));
        expect(emails()).toEqual(['trial@example.com', 'paying@example.com']);

        fireEvent.click(screen.getByTestId('admin-user-filter-unverified'));
        fireEvent.click(screen.getByTestId('admin-user-filter-paid'));
        expect(emails()).toEqual(['new@example.com', 'trial@example.com']);

        fireEvent.click(screen.getByTestId('admin-user-filter-clear'));
        expect(emails()).toHaveLength(3);
    });

    it('shows an empty row when nothing matches', async () => {
        render(<AdminUserStatusTable />);
        await screen.findByTestId('admin-user-access-1');
        fireEvent.click(screen.getByTestId('admin-user-filter'));
        fireEvent.click(screen.getByTestId('admin-user-filter-member'));
        expect(
            screen.getByTestId('admin-user-filter-empty')
        ).toBeInTheDocument();
    });
});

it('sums the items each user created and opens the breakdown on click', async () => {
    render(<AdminUserStatusTable />);

    const button = await screen.findByRole('button', { name: /12 items/ });
    expect(screen.getByTestId('admin-user-items-1')).toHaveTextContent(
        'Nothing yet'
    );
    expect(screen.queryByTestId('admin-user-usage-2')).toBeNull();

    fireEvent.click(button);
    const details = screen.getByTestId('admin-user-usage-2');
    expect(details).toHaveTextContent('Tasks9');
    expect(details).toHaveTextContent('Projects2');
    expect(details).toHaveTextContent('Habits0');

    fireEvent.click(button);
    expect(screen.queryByTestId('admin-user-usage-2')).toBeNull();
});
