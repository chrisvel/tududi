import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberRemoveDialog from '../MemberRemoveDialog';
import { fetchMemberHandoff } from '../../../utils/membersService';

jest.mock('../../../utils/membersService', () => ({
    fetchMemberHandoff: jest.fn(),
}));

const candidates = [
    { id: 1, person_uid: 'me', name: 'Lea', is_self: true },
    { id: 3, person_uid: 'cal', name: 'Cal', is_self: false },
];

const renderDialog = (onConfirm = jest.fn()) => {
    render(
        <MemberRemoveDialog
            memberId={2}
            memberName="Bea"
            onConfirm={onConfirm}
            onCancel={jest.fn()}
        />
    );
    return onConfirm;
};

describe('Remove member dialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows the open tasks and hands them to the remover by default', async () => {
        (fetchMemberHandoff as jest.Mock).mockResolvedValue({
            open_assigned_tasks: 7,
            candidates,
        });
        const onConfirm = renderDialog();

        expect(await screen.findByTestId('member-remove-handoff')).toBeVisible();
        expect(screen.getByText(/Open tasks assigned to/)).toBeVisible();
        const select = screen.getByTestId(
            'member-remove-handoff-select'
        ) as HTMLSelectElement;
        expect(select.value).toBe('1');

        fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
        expect(onConfirm).toHaveBeenCalledWith(1);
    });

    it('hands the tasks to whoever is picked, or to nobody', async () => {
        (fetchMemberHandoff as jest.Mock).mockResolvedValue({
            open_assigned_tasks: 2,
            candidates,
        });
        const onConfirm = renderDialog();
        const select = await screen.findByTestId('member-remove-handoff-select');

        fireEvent.change(select, { target: { value: '3' } });
        fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
        expect(onConfirm).toHaveBeenLastCalledWith(3);

        fireEvent.change(select, { target: { value: '' } });
        fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
        expect(onConfirm).toHaveBeenLastCalledWith(null);
    });

    it('shows no picker when the member has no open tasks', async () => {
        (fetchMemberHandoff as jest.Mock).mockResolvedValue({
            open_assigned_tasks: 0,
            candidates,
        });
        const onConfirm = renderDialog();

        const confirm = screen.getByTestId('confirm-dialog-confirm');
        await waitFor(() => expect(confirm).not.toBeDisabled());
        expect(
            screen.queryByTestId('member-remove-handoff')
        ).not.toBeInTheDocument();

        fireEvent.click(confirm);
        expect(onConfirm).toHaveBeenCalledWith(null);
    });
});
