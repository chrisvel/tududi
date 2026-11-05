import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportWizard from '../ImportWizard';
import {
    commitImport,
    previewImport,
    uploadImportFile,
} from '../../../utils/spreadsheetService';

jest.mock('react-router-dom', () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to}>{children}</a>
    ),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, optionsOrDefault?: any, maybeOptions?: any) => {
            const options =
                typeof optionsOrDefault === 'object' && optionsOrDefault
                    ? optionsOrDefault
                    : maybeOptions;
            let template =
                typeof optionsOrDefault === 'string'
                    ? optionsOrDefault
                    : options?.defaultValue || key;
            if (options) {
                template = template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
                    String(options[name] ?? '')
                );
            }
            return template;
        },
    }),
}));

jest.mock('../../../utils/projectsService', () => ({
    fetchProjects: jest
        .fn()
        .mockResolvedValue([{ uid: 'p1', name: 'Riverside' }]),
}));

jest.mock('../../../utils/spreadsheetService', () => {
    const actual = jest.requireActual('../../../utils/spreadsheetService');
    return {
        ...actual,
        uploadImportFile: jest.fn(),
        previewImport: jest.fn(),
        commitImport: jest.fn(),
        discardImport: jest.fn().mockResolvedValue(undefined),
        loadImportColumns: jest.fn(),
        undoImport: jest.fn(),
    };
});

const job = {
    uid: 'job1',
    file_name: 'schedule.csv',
    status: 'parsed',
    sheets: [
        {
            name: 'CSV',
            truncated: false,
            has_levels: false,
            header_row: 0,
            headers: ['Task', 'Deadline', 'Contractor'],
            sample: [['Foundations', '13/11/2026', 'Acme']],
            row_count: 1,
            suggested_mapping: ['name', 'due', 'note_append'],
        },
    ],
};

const preview = {
    problems: [],
    counts: {
        create: 1,
        update: 0,
        skip: 0,
        warnings: 1,
        new_projects: 0,
        new_areas: 0,
        new_tags: 0,
    },
    date_columns: { due: { detected: 'dmy', ambiguous: false } },
    hierarchy_used: 'flat',
    new_projects: [],
    new_areas: [],
    unknown_values: { status: [], priority: [], assignee: [] },
    assignable: [],
    rows: [
        {
            row_number: 2,
            action: 'create',
            name: 'Foundations',
            project: 'Riverside',
            project_is_new: false,
            parent: null,
            due: '2026-11-13',
            errors: [],
            warnings: [{ code: 'unknown_status', value: 'Approved' }],
        },
    ],
    total_rows: 1,
};

describe('ImportWizard', () => {
    it('uploads, maps, reviews and imports into the project it was opened from', async () => {
        (uploadImportFile as jest.Mock).mockResolvedValue(job);
        (previewImport as jest.Mock).mockResolvedValue(preview);
        (commitImport as jest.Mock).mockResolvedValue({
            uid: 'job1',
            counts: {
                created: 1,
                updated: 0,
                skipped: 0,
                new_projects: 0,
                new_areas: 0,
            },
            project_uids: ['p1'],
        });
        const onImported = jest.fn();

        const { container } = render(
            <ImportWizard
                projectUid="p1"
                onClose={jest.fn()}
                onImported={onImported}
            />
        );

        const input = document.body.querySelector(
            'input[type="file"]'
        ) as HTMLInputElement;
        fireEvent.change(input, {
            target: {
                files: [
                    new File(['Task'], 'schedule.csv', { type: 'text/csv' }),
                ],
            },
        });

        expect(
            await screen.findByText('Match the columns')
        ).toBeInTheDocument();
        expect(screen.getByText('Contractor')).toBeInTheDocument();
        expect(screen.getByLabelText('Contractor')).toHaveValue('note_append');

        fireEvent.click(screen.getByText('Check the rows'));
        await waitFor(() => expect(previewImport).toHaveBeenCalled());
        const options = (previewImport as jest.Mock).mock.calls[0][1];
        expect(options.target).toMatchObject({
            mode: 'project',
            project_uid: 'p1',
        });
        expect(options.mapping).toEqual(['name', 'due', 'note_append']);

        expect(await screen.findByText('1 new tasks')).toBeInTheDocument();
        // The mocked t falls back to the issue code.
        expect(screen.getByText('unknown_status')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Import 1 rows'));
        expect(await screen.findByText('Imported 1 tasks')).toBeInTheDocument();
        expect(onImported).toHaveBeenCalled();
        expect(container).toBeDefined();
    });
});
