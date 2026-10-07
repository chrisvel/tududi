import React from 'react';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import PeopleList from '../PeopleList';
import { useStore } from '../../../store/useStore';
import { fetchPeople } from '../../../utils/peopleService';
import { createMember } from '../../../utils/membersService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, options?: any) => {
            const text = typeof fallback === 'string' ? fallback : key;
            return options
                ? text.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) =>
                      String(options[k])
                  )
                : text;
        },
    }),
}));

const showSuccessToast = jest.fn();
const showErrorToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showSuccessToast, showErrorToast }),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPeople: jest.fn(),
    createPerson: jest.fn(),
    updatePerson: jest.fn(),
    deletePerson: jest.fn(),
}));

jest.mock('../../../utils/membersService', () => ({
    createMember: jest.fn(),
}));

const people = [
    {
        uid: 'me',
        name: 'Wife',
        kind: 'member',
        can_edit: true,
        is_self: true,
        linked_user_id: 1,
        account_status: 'active',
        relationship_type: 'other',
    },
    {
        uid: 'kid',
        name: 'Kid',
        kind: 'member',
        can_edit: false,
        linked_user_id: 2,
        account_status: 'no_sign_in',
        relationship_type: 'other',
    },
    {
        uid: 'boss',
        name: 'Admin',
        kind: 'member',
        can_edit: false,
        linked_user_id: 3,
        account_status: 'active',
        relationship_type: 'other',
    },
    {
        uid: 'plumber',
        name: 'Plumber',
        kind: 'contact',
        can_edit: true,
        relationship_type: 'work',
    },
    {
        uid: 'nan',
        name: 'Grandma',
        kind: 'contact',
        can_edit: true,
        relationship_type: 'family',
    },
];

const setCapabilities = (over: Partial<Record<string, boolean>> = {}) =>
    useStore.getState().userSettingsStore.setCapabilities({
        create_people: true,
        invite_members: true,
        create_projects: true,
        ...over,
    });

const renderPage = () =>
    render(
        <MemoryRouter>
            <PeopleList />
        </MemoryRouter>
    );

describe('People page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fetchPeople as jest.Mock).mockResolvedValue(people);
        setCapabilities();
        useStore.getState().userSettingsStore.setRole('user');
    });

    afterEach(() => {
        useStore.getState().userSettingsStore.setCapabilities(null);
        useStore.getState().userSettingsStore.setRole(null);
    });

    describe('the list', () => {
        it('shows members and contacts together', async () => {
            renderPage();

            for (const name of ['Wife', 'Kid', 'Admin', 'Plumber', 'Grandma']) {
                expect(await screen.findByText(name)).toBeInTheDocument();
            }
        });

        it('marks members, and says when one cannot sign in yet', async () => {
            renderPage();
            await screen.findByText('Kid');

            expect(screen.getAllByText('Member')).toHaveLength(2);
            expect(
                screen.getByText("Member, can't sign in yet")
            ).toBeInTheDocument();
        });

        it('shows the relationship of a contact', async () => {
            renderPage();
            await screen.findByText('Plumber');

            expect(screen.getByText('Work')).toBeInTheDocument();
            expect(screen.getByText('Family')).toBeInTheDocument();
        });
    });

    describe('the filters', () => {
        it('count members and contacts', async () => {
            renderPage();
            await screen.findByText('Kid');

            expect(screen.getByTestId('people-filter-all')).toHaveTextContent(
                '5'
            );
            expect(
                screen.getByTestId('people-filter-members')
            ).toHaveTextContent('3');
            expect(
                screen.getByTestId('people-filter-contacts')
            ).toHaveTextContent('2');
        });

        it('show only members', async () => {
            renderPage();
            await screen.findByText('Kid');

            fireEvent.click(screen.getByTestId('people-filter-members'));

            expect(screen.getByText('Kid')).toBeInTheDocument();
            expect(screen.queryByText('Plumber')).toBeNull();
            expect(screen.queryByText('Grandma')).toBeNull();
        });

        it('show only contacts', async () => {
            renderPage();
            await screen.findByText('Kid');

            fireEvent.click(screen.getByTestId('people-filter-contacts'));

            expect(screen.getByText('Plumber')).toBeInTheDocument();
            expect(screen.queryByText('Kid')).toBeNull();
            expect(screen.queryByText('Wife')).toBeNull();
        });

        it('go back to everyone', async () => {
            renderPage();
            await screen.findByText('Kid');
            fireEvent.click(screen.getByTestId('people-filter-contacts'));

            fireEvent.click(screen.getByTestId('people-filter-all'));

            expect(screen.getByText('Kid')).toBeInTheDocument();
            expect(screen.getByText('Plumber')).toBeInTheDocument();
        });
    });

    describe('what you can do to an entry', () => {
        it('has no menu on another member', async () => {
            renderPage();
            await screen.findByText('Kid');

            expect(screen.queryByTestId('person-menu-kid')).toBeNull();
            expect(screen.queryByTestId('person-menu-boss')).toBeNull();
        });

        it('has a menu on your own contacts', async () => {
            renderPage();
            await screen.findByText('Plumber');

            expect(
                screen.getByTestId('person-menu-plumber')
            ).toBeInTheDocument();
        });

        it('offers to give a contact an account', async () => {
            renderPage();
            await screen.findByText('Plumber');

            fireEvent.click(screen.getByTestId('person-menu-plumber'));

            expect(screen.getByTestId('give-account-plumber')).toBeVisible();
        });

        it('does not offer that for a member', async () => {
            renderPage();
            await screen.findByText('Wife');

            fireEvent.click(screen.getByTestId('person-menu-me'));

            expect(screen.queryByTestId('give-account-me')).toBeNull();
            expect(screen.queryByText('Archive')).toBeNull();
            expect(screen.queryByText('Delete')).toBeNull();
            expect(screen.getByText('Edit')).toBeVisible();
        });

        it('does not offer it without the invite permission', async () => {
            setCapabilities({ invite_members: false });
            renderPage();
            await screen.findByText('Plumber');

            fireEvent.click(screen.getByTestId('person-menu-plumber'));

            expect(screen.queryByTestId('give-account-plumber')).toBeNull();
            expect(screen.getByText('Archive')).toBeVisible();
        });
    });

    describe('the buttons', () => {
        it('offer both for someone who may do both', async () => {
            renderPage();
            await screen.findByText('Plumber');

            expect(screen.getByTestId('add-member-button')).toBeVisible();
            expect(screen.getByTestId('add-contact-button')).toBeVisible();
        });

        it('hide Add member without the invite permission', async () => {
            setCapabilities({ invite_members: false });
            renderPage();
            await screen.findByText('Plumber');

            expect(screen.queryByTestId('add-member-button')).toBeNull();
            expect(screen.getByTestId('add-contact-button')).toBeVisible();
        });

        it('hide both for a guest', async () => {
            setCapabilities({ create_people: false, invite_members: false });
            renderPage();
            await screen.findByText('Plumber');

            expect(screen.queryByTestId('add-member-button')).toBeNull();
            expect(screen.queryByTestId('add-contact-button')).toBeNull();
        });
    });

    describe('adding a member', () => {
        it('opens the member form', async () => {
            renderPage();
            await screen.findByText('Plumber');

            fireEvent.click(screen.getByTestId('add-member-button'));

            expect(await screen.findByTestId('member-modal')).toBeVisible();
            expect(screen.queryByTestId('convert-note')).toBeNull();
        });

        it('adds the member and refreshes the list', async () => {
            (createMember as jest.Mock).mockResolvedValue({
                id: 9,
                email: null,
                role: 'user',
                account_status: 'no_sign_in',
                person_uid: 'new',
                invited: false,
                email_sent: false,
            });
            renderPage();
            await screen.findByText('Plumber');
            fireEvent.click(screen.getByTestId('add-member-button'));
            fireEvent.change(await screen.findByTestId('member-name'), {
                target: { value: 'Emma' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                name: 'Emma',
                role: 'user',
            });
            await waitFor(() =>
                expect(showSuccessToast).toHaveBeenCalledWith('Member added')
            );
            // The first load, then the page reloads and so does the sidebar's list.
            await waitFor(() => expect(fetchPeople).toHaveBeenCalledTimes(3));
        });

        it('says so when an invitation was sent', async () => {
            (createMember as jest.Mock).mockResolvedValue({
                id: 9,
                email: 'wife@example.com',
                role: 'user',
                account_status: 'invited',
                person_uid: 'new',
                invited: true,
                email_sent: true,
            });
            renderPage();
            await screen.findByText('Plumber');
            fireEvent.click(screen.getByTestId('add-member-button'));
            fireEvent.change(await screen.findByTestId('member-email'), {
                target: { value: 'wife@example.com' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() =>
                expect(showSuccessToast).toHaveBeenCalledWith(
                    'Invitation sent to wife@example.com'
                )
            );
        });
    });

    describe('giving a contact an account', () => {
        const openGiveAccount = async () => {
            renderPage();
            await screen.findByText('Plumber');
            fireEvent.click(screen.getByTestId('person-menu-plumber'));
            fireEvent.click(screen.getByTestId('give-account-plumber'));
            return screen.findByTestId('member-modal');
        };

        it('names the contact and says its private notes are not carried over', async () => {
            const modal = await openGiveAccount();

            expect(
                within(modal).getByText('Give Plumber an account')
            ).toBeVisible();
            expect(within(modal).getByTestId('convert-note')).toHaveTextContent(
                'Your private notes on this contact are not carried over'
            );
        });

        it('sends the contact along so it keeps its history', async () => {
            (createMember as jest.Mock).mockResolvedValue({
                id: 9,
                email: null,
                role: 'user',
                account_status: 'no_sign_in',
                person_uid: 'plumber',
                invited: false,
                email_sent: false,
            });
            await openGiveAccount();

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                name: 'Plumber',
                role: 'user',
                person_uid: 'plumber',
            });
        });
    });
});
