import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskTitleSection from '../TaskTitleSection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue,
    }),
}));

describe('TaskTitleSection - Task Intelligence Settings', () => {
    const mockOnChange = jest.fn();
    const mockOnSubmit = jest.fn();

    const defaultProps = {
        taskId: 1,
        value: '',
        onChange: mockOnChange,
        taskAnalysis: null,
        taskIntelligenceEnabled: false,
        onSubmit: mockOnSubmit,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('When task intelligence is DISABLED', () => {
        it('should NOT show AI suggestions even when task is vague', () => {
            const vagueTaskAnalysis = {
                isVague: true,
                severity: 'high' as const,
                reason: 'short',
                suggestion: 'Try adding more details',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={false}
                    taskAnalysis={vagueTaskAnalysis}
                    value="test"
                />
            );

            // AI suggestion messages should NOT be in the document
            expect(
                screen.queryByText('Make it more descriptive!')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Be more specific!')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Add an action verb!')
            ).not.toBeInTheDocument();
        });

        it('should NOT show AI suggestions for short task names', () => {
            const shortTaskAnalysis = {
                isVague: true,
                severity: 'medium' as const,
                reason: 'short',
                suggestion:
                    'Try adding more details like "Call dentist to schedule cleaning appointment" instead of just "Call dentist"',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={false}
                    taskAnalysis={shortTaskAnalysis}
                    value="call"
                />
            );

            expect(
                screen.queryByText('Make it more descriptive!')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText(/Try adding more details/)
            ).not.toBeInTheDocument();
        });

        it('should NOT show AI suggestions for tasks without action verbs', () => {
            const noVerbAnalysis = {
                isVague: true,
                severity: 'low' as const,
                reason: 'no_verb',
                suggestion:
                    'What specific action do you need to take? Try starting with a verb.',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={false}
                    taskAnalysis={noVerbAnalysis}
                    value="dentist appointment"
                />
            );

            expect(
                screen.queryByText('Add an action verb!')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText(/What specific action/)
            ).not.toBeInTheDocument();
        });

        it('should NOT show AI suggestions for vague patterns', () => {
            const vaguePatternAnalysis = {
                isVague: true,
                severity: 'medium' as const,
                reason: 'vague_pattern',
                suggestion: 'Try to be more specific',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={false}
                    taskAnalysis={vaguePatternAnalysis}
                    value="check on things"
                />
            );

            expect(
                screen.queryByText('Be more specific!')
            ).not.toBeInTheDocument();
        });
    });

    describe('When task intelligence is ENABLED', () => {
        it('should show "Make it more descriptive!" for short task names', () => {
            const shortTaskAnalysis = {
                isVague: true,
                severity: 'medium' as const,
                reason: 'short',
                suggestion:
                    'Try adding more details like "Call dentist to schedule cleaning appointment" instead of just "Call dentist"',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={true}
                    taskAnalysis={shortTaskAnalysis}
                    value="call"
                />
            );

            expect(
                screen.getByText('Make it more descriptive!')
            ).toBeInTheDocument();
        });

        it('should show "Add an action verb!" for tasks without verbs', () => {
            const noVerbAnalysis = {
                isVague: true,
                severity: 'low' as const,
                reason: 'no_verb',
                suggestion:
                    'What specific action do you need to take? Try starting with a verb.',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={true}
                    taskAnalysis={noVerbAnalysis}
                    value="dentist appointment"
                />
            );

            expect(screen.getByText('Add an action verb!')).toBeInTheDocument();
        });

        it('should show "Be more specific!" for vague patterns', () => {
            const vaguePatternAnalysis = {
                isVague: true,
                severity: 'medium' as const,
                reason: 'vague_pattern',
                suggestion: 'Try to be more specific',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={true}
                    taskAnalysis={vaguePatternAnalysis}
                    value="check on things"
                />
            );

            expect(screen.getByText('Be more specific!')).toBeInTheDocument();
        });

        it('should NOT show suggestions when task is not vague', () => {
            const goodTaskAnalysis = {
                isVague: false,
                severity: 'low' as const,
                reason: '',
            };

            render(
                <TaskTitleSection
                    {...defaultProps}
                    taskIntelligenceEnabled={true}
                    taskAnalysis={goodTaskAnalysis}
                    value="Call dentist to schedule annual cleaning appointment"
                />
            );

            expect(
                screen.queryByText('Make it more descriptive!')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Be more specific!')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Add an action verb!')
            ).not.toBeInTheDocument();
        });
    });

    describe('Task input rendering', () => {
        it('should render task name input with correct value', () => {
            const { container } = render(
                <TaskTitleSection {...defaultProps} value="My task name" />
            );

            const input = container.querySelector('input[name="name"]');
            expect(input).toBeInTheDocument();
            expect(input).toHaveValue('My task name');
        });

        it('should render with placeholder text', () => {
            const { container } = render(
                <TaskTitleSection {...defaultProps} value="" />
            );

            const input = container.querySelector('input[name="name"]');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('placeholder', 'Add Task Name');
        });

        it('should have required attribute', () => {
            const { container } = render(
                <TaskTitleSection {...defaultProps} value="" />
            );

            const input = container.querySelector('input[name="name"]');
            expect(input).toHaveAttribute('required');
        });
    });
});
