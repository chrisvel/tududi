import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberModal from '../MemberModal';
import { useStore } from '../../../store/useStore';
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

jest.mock('../../../utils/membersService', () => ({
    createMember: jest.fn(),
}));

const created = {
    id: 9,
    email: null,
    role: 'user',
    account_status: 'no_sign_in',
    person_uid: 'p1',
    invited: false,
    email_sent: false,
};

describe('Member form', () => {
    const onCreated = jest.fn();
    const onClose = jest.fn();

    const renderModal = (person: any = null) =>
        render(
            <MemberModal
                person={person}
                onCreated={onCreated}
                onClose={onClose}
            />
        );

    beforeEach(() => {
        jest.clearAllMocks();
        (createMember as jest.Mock).mockResolvedValue(created);
        useStore.getState().userSettingsStore.setRole('user');
    });

    afterEach(() => useStore.getState().userSettingsStore.setRole(null));

    describe('when adding someone new', () => {
        it('is titled Add member and has no note about a contact', () => {
            renderModal();

            expect(
                screen.getByText('Add member', { selector: 'h3' })
            ).toBeVisible();
            expect(screen.queryByTestId('convert-note')).toBeNull();
        });

        it('says what having no email means', () => {
            renderModal();

            expect(screen.getByTestId('member-email-hint')).toHaveTextContent(
                'cannot sign in yet'
            );
            expect(screen.getByTestId('member-email')).not.toBeRequired();
        });

        it('offers a password only once there is an email', () => {
            renderModal();
            expect(screen.queryByTestId('member-password')).toBeNull();

            fireEvent.change(screen.getByTestId('member-email'), {
                target: { value: 'a@example.com' },
            });

            expect(screen.getByTestId('member-password')).toBeVisible();
            expect(screen.getByTestId('member-email-hint')).toHaveTextContent(
                'invitation'
            );

            fireEvent.change(screen.getByTestId('member-email'), {
                target: { value: '' },
            });
            expect(screen.queryByTestId('member-password')).toBeNull();
        });

        it('fills in a password when asked to generate one', () => {
            renderModal();
            fireEvent.change(screen.getByTestId('member-email'), {
                target: { value: 'a@example.com' },
            });

            fireEvent.click(screen.getByTestId('member-generate-password'));

            expect(
                (screen.getByTestId('member-password') as HTMLInputElement)
                    .value.length
            ).toBeGreaterThanOrEqual(8);
        });
    });

    describe('the role', () => {
        const options = () =>
            Array.from(
                (screen.getByTestId('member-role') as HTMLSelectElement).options
            ).map((o) => o.value);

        it('is a user or a guest for someone who is not an admin', () => {
            renderModal();

            expect(options()).toEqual(['user', 'guest']);
        });

        it('can also be an admin when an admin adds the member', () => {
            useStore.getState().userSettingsStore.setRole('admin');
            renderModal();

            expect(options()).toEqual(['user', 'guest', 'admin']);
        });

        it('is sent with the member', async () => {
            renderModal();
            fireEvent.change(screen.getByTestId('member-name'), {
                target: { value: 'Emma' },
            });
            fireEvent.change(screen.getByTestId('member-role'), {
                target: { value: 'guest' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                name: 'Emma',
                role: 'guest',
            });
        });
    });

    describe('submitting', () => {
        it('adds a member with just a name, then reports and closes', async () => {
            renderModal();
            fireEvent.change(screen.getByTestId('member-name'), {
                target: { value: 'Emma' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() =>
                expect(onCreated).toHaveBeenCalledWith(created)
            );
            expect(createMember).toHaveBeenCalledWith({
                name: 'Emma',
                role: 'user',
            });
            expect(onClose).toHaveBeenCalled();
        });

        it('sends an email alone so the member is invited', async () => {
            renderModal();
            fireEvent.change(screen.getByTestId('member-email'), {
                target: { value: 'wife@example.com' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                email: 'wife@example.com',
                role: 'user',
            });
        });

        it('sends an email and a password so the member is signed up', async () => {
            renderModal();
            fireEvent.change(screen.getByTestId('member-email'), {
                target: { value: 'wife@example.com' },
            });
            fireEvent.change(screen.getByTestId('member-password'), {
                target: { value: 'Str0ng-passw0rd!' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
                role: 'user',
            });
        });

        it('does not send a password typed before the email was cleared', async () => {
            renderModal();
            const email = screen.getByTestId('member-email');
            fireEvent.change(email, { target: { value: 'wife@example.com' } });
            fireEvent.change(screen.getByTestId('member-password'), {
                target: { value: 'Str0ng-passw0rd!' },
            });
            fireEvent.change(email, { target: { value: '' } });
            fireEvent.change(screen.getByTestId('member-name'), {
                target: { value: 'Emma' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                name: 'Emma',
                role: 'user',
            });
        });

        it('asks for a name when there is neither a name nor an email', async () => {
            renderModal();

            fireEvent.click(screen.getByTestId('member-submit'));

            expect(
                await screen.findByText('Enter a name when there is no email')
            ).toBeVisible();
            expect(createMember).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
        });

        it('shows what went wrong and stays open', async () => {
            (createMember as jest.Mock).mockRejectedValue(
                new Error('Email already exists')
            );
            renderModal();
            fireEvent.change(screen.getByTestId('member-email'), {
                target: { value: 'wife@example.com' },
            });

            fireEvent.click(screen.getByTestId('member-submit'));

            expect(
                await screen.findByText('Email already exists')
            ).toBeVisible();
            expect(onClose).not.toHaveBeenCalled();
            expect(onCreated).not.toHaveBeenCalled();
        });

        it('closes without adding anyone when cancelled', () => {
            renderModal();

            fireEvent.click(screen.getByText('Cancel'));

            expect(onClose).toHaveBeenCalled();
            expect(createMember).not.toHaveBeenCalled();
        });
    });

    describe('when turning a contact into a member', () => {
        const contact = {
            uid: 'plumber',
            name: 'Emma Veleris',
            email: 'emma@example.com',
        };

        it('names the contact and warns about its private notes', () => {
            renderModal(contact);

            expect(
                screen.getByText('Give Emma Veleris an account')
            ).toBeVisible();
            expect(screen.getByTestId('convert-note')).toHaveTextContent(
                'Your private notes on this contact are not carried over'
            );
        });

        it('starts from what the contact already has', () => {
            renderModal(contact);

            expect(
                (screen.getByTestId('member-name') as HTMLInputElement).value
            ).toBe('Emma');
            expect(
                (screen.getByTestId('member-surname') as HTMLInputElement).value
            ).toBe('Veleris');
            expect(
                (screen.getByTestId('member-email') as HTMLInputElement).value
            ).toBe('emma@example.com');
        });

        it('sends the contact so it keeps its history', async () => {
            renderModal(contact);

            fireEvent.click(screen.getByTestId('member-submit'));

            await waitFor(() => expect(createMember).toHaveBeenCalled());
            expect(createMember).toHaveBeenCalledWith({
                name: 'Emma',
                surname: 'Veleris',
                email: 'emma@example.com',
                role: 'user',
                person_uid: 'plumber',
            });
        });

        it('labels the button Give account', () => {
            renderModal(contact);

            expect(screen.getByTestId('member-submit')).toHaveTextContent(
                'Give account'
            );
        });
    });
});
