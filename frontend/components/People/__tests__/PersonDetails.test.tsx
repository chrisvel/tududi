import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PersonDetails from '../PersonDetails';
import { fetchPersonByUid } from '../../../utils/peopleService';

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/peopleService', () => ({
    fetchPersonByUid: jest.fn(),
    updatePerson: jest.fn(),
    deletePerson: jest.fn(),
}));

const renderDetails = (person: any) => {
    (fetchPersonByUid as jest.Mock).mockResolvedValue(person);
    return render(
        <MemoryRouter initialEntries={['/person/abc']}>
            <Routes>
                <Route path="/person/:uid" element={<PersonDetails />} />
            </Routes>
        </MemoryRouter>
    );
};

describe('Person details', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ tasks: [] }),
        });
    });

    it('lets you edit, archive and delete your own contact', async () => {
        renderDetails({
            uid: 'abc',
            name: 'Plumber',
            kind: 'contact',
            can_edit: true,
        });

        expect(await screen.findByTitle('Edit person')).toBeVisible();
        expect(screen.getByTitle('Archive')).toBeVisible();
        expect(screen.getByTitle('Delete person')).toBeVisible();
    });

    it('shows another member without any way to change them', async () => {
        renderDetails({
            uid: 'abc',
            name: 'Kid',
            kind: 'member',
            can_edit: false,
        });

        expect(await screen.findByText('Kid')).toBeVisible();
        expect(screen.queryByTitle('Edit person')).toBeNull();
        expect(screen.queryByTitle('Archive')).toBeNull();
        expect(screen.queryByTitle('Delete person')).toBeNull();
    });

    it('lets you edit the person of your own account but not archive or delete it', async () => {
        renderDetails({
            uid: 'abc',
            name: 'Wife',
            kind: 'member',
            can_edit: true,
            is_self: true,
        });

        expect(await screen.findByTitle('Edit person')).toBeVisible();
        expect(screen.queryByTitle('Archive')).toBeNull();
        expect(screen.queryByTitle('Delete person')).toBeNull();
    });

    it('keeps working for an entry from before people were marked', async () => {
        renderDetails({ uid: 'abc', name: 'Old contact' });

        expect(await screen.findByTitle('Edit person')).toBeVisible();
        expect(screen.getByTitle('Delete person')).toBeVisible();
    });
});
