const RecurringTaskService = require('../../../services/recurringTaskService');
const { Task } = require('../../../models');

describe('RecurringTaskService', () => {
    describe('Date Calculation Tests', () => {
        describe('calculateNextDueDate', () => {
            // Test daily recurrence
            describe('Daily recurrence', () => {
                it('should calculate next daily occurrence correctly', () => {
                    const task = {
                        recurrence_type: 'daily',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-01-16T10:00:00Z'));
                });

                it('should handle custom daily intervals', () => {
                    const task = {
                        recurrence_type: 'daily',
                        recurrence_interval: 3,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-01-18T10:00:00Z'));
                });

                it('should handle edge case with zero interval', () => {
                    const task = {
                        recurrence_type: 'daily',
                        recurrence_interval: 0,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-01-16T10:00:00Z'));
                });
            });

            // Test weekly recurrence
            describe('Weekly recurrence', () => {
                it('should calculate next weekly occurrence correctly', () => {
                    const task = {
                        recurrence_type: 'weekly',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z'); // Wednesday
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-01-22T10:00:00Z'));
                });

                it('should handle weekly with specific weekday', () => {
                    const task = {
                        recurrence_type: 'weekly',
                        recurrence_interval: 1,
                        recurrence_weekday: 1, // Monday
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z'); // Wednesday
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-01-20T10:00:00Z')); // Next Monday
                });

                it('should handle bi-weekly recurrence', () => {
                    const task = {
                        recurrence_type: 'weekly',
                        recurrence_interval: 2,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-01-29T10:00:00Z'));
                });
            });

            // Test monthly recurrence
            describe('Monthly recurrence', () => {
                it('should calculate next monthly occurrence correctly', () => {
                    const task = {
                        recurrence_type: 'monthly',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-02-15T10:00:00Z'));
                });

                it('should handle month boundaries correctly', () => {
                    const task = {
                        recurrence_type: 'monthly',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-31T10:00:00Z'); // January 31st
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // February only has 28 days in 2025, should go to Feb 28
                    expect(nextDate).toEqual(new Date('2025-02-28T10:00:00Z'));
                });

                it('should handle leap year correctly', () => {
                    const task = {
                        recurrence_type: 'monthly',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2024-01-29T10:00:00Z'); // 2024 is a leap year
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2024-02-29T10:00:00Z'));
                });

                it('should handle custom monthly intervals', () => {
                    const task = {
                        recurrence_type: 'monthly',
                        recurrence_interval: 3,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-04-15T10:00:00Z'));
                });

                it('should handle monthly with specific day', () => {
                    const task = {
                        recurrence_type: 'monthly',
                        recurrence_interval: 1,
                        recurrence_month_day: 5,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toEqual(new Date('2025-02-05T10:00:00Z'));
                });
            });

            // Test monthly weekday recurrence
            describe('Monthly weekday recurrence', () => {
                it('should calculate first Monday of month correctly', () => {
                    const task = {
                        recurrence_type: 'monthly_weekday',
                        recurrence_interval: 1,
                        recurrence_weekday: 1, // Monday
                        recurrence_week_of_month: 1, // First week
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // First Monday of February 2025 is February 3rd
                    expect(nextDate).toEqual(new Date('2025-02-03T10:00:00Z'));
                });

                it('should calculate last Friday of month correctly', () => {
                    const task = {
                        recurrence_type: 'monthly_weekday',
                        recurrence_interval: 1,
                        recurrence_weekday: 5, // Friday
                        recurrence_week_of_month: 5, // Last week (represented as 5)
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // Last Friday of February 2025 is February 28th
                    expect(nextDate).toEqual(new Date('2025-02-28T10:00:00Z'));
                });

                it('should handle third Wednesday of month', () => {
                    const task = {
                        recurrence_type: 'monthly_weekday',
                        recurrence_interval: 1,
                        recurrence_weekday: 3, // Wednesday
                        recurrence_week_of_month: 3, // Third week
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // Third Wednesday of February 2025 is February 19th
                    expect(nextDate).toEqual(new Date('2025-02-19T10:00:00Z'));
                });
            });

            // Test monthly last day recurrence
            describe('Monthly last day recurrence', () => {
                it('should calculate last day of month correctly', () => {
                    const task = {
                        recurrence_type: 'monthly_last_day',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // Last day of February 2025 is February 28th
                    expect(nextDate).toEqual(new Date('2025-02-28T10:00:00Z'));
                });

                it('should handle leap year last day correctly', () => {
                    const task = {
                        recurrence_type: 'monthly_last_day',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2024-01-15T10:00:00Z'); // 2024 is a leap year
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // Last day of February 2024 is February 29th
                    expect(nextDate).toEqual(new Date('2024-02-29T10:00:00Z'));
                });

                it('should handle different month lengths', () => {
                    const task = {
                        recurrence_type: 'monthly_last_day',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-04-15T10:00:00Z'); // April has 30 days
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    // Last day of May 2025 is May 31st
                    expect(nextDate).toEqual(new Date('2025-05-31T10:00:00Z'));
                });
            });

            // Test edge cases and invalid inputs
            describe('Edge cases and invalid inputs', () => {
                it('should return null for unsupported recurrence type', () => {
                    const task = {
                        recurrence_type: 'invalid_type',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toBeNull();
                });

                it('should return null for none recurrence type', () => {
                    const task = {
                        recurrence_type: 'none',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toBeNull();
                });

                it('should handle invalid date inputs gracefully', () => {
                    const task = {
                        recurrence_type: 'daily',
                        recurrence_interval: 1,
                    };
                    const fromDate = new Date('invalid-date');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toBeNull();
                });

                it('should handle missing task properties', () => {
                    const task = {}; // No recurrence properties
                    const fromDate = new Date('2025-01-15T10:00:00Z');
                    const nextDate = RecurringTaskService.calculateNextDueDate(
                        task,
                        fromDate
                    );

                    expect(nextDate).toBeNull();
                });
            });
        });

        describe('Helper Functions', () => {
            describe('_getFirstWeekdayOfMonth', () => {
                it('should find first Monday of January 2025', () => {
                    const date = RecurringTaskService._getFirstWeekdayOfMonth(
                        2025,
                        0,
                        1
                    ); // January, Monday
                    expect(date.getDate()).toBe(6); // January 6, 2025 is the first Monday
                });

                it('should find first Sunday of February 2025', () => {
                    const date = RecurringTaskService._getFirstWeekdayOfMonth(
                        2025,
                        1,
                        0
                    ); // February, Sunday
                    expect(date.getDate()).toBe(2); // February 2, 2025 is the first Sunday
                });
            });

            describe('_getLastWeekdayOfMonth', () => {
                it('should find last Friday of January 2025', () => {
                    const date = RecurringTaskService._getLastWeekdayOfMonth(
                        2025,
                        0,
                        5
                    ); // January, Friday
                    expect(date.getDate()).toBe(31); // January 31, 2025 is the last Friday
                });

                it('should find last Monday of February 2025', () => {
                    const date = RecurringTaskService._getLastWeekdayOfMonth(
                        2025,
                        1,
                        1
                    ); // February, Monday
                    expect(date.getDate()).toBe(24); // February 24, 2025 is the last Monday
                });
            });

            describe('_getNthWeekdayOfMonth', () => {
                it('should find second Tuesday of March 2025', () => {
                    const date = RecurringTaskService._getNthWeekdayOfMonth(
                        2025,
                        2,
                        2,
                        2
                    ); // March, Tuesday, 2nd
                    expect(date.getDate()).toBe(11); // March 11, 2025 is the second Tuesday
                });

                it('should find fourth Thursday of April 2025', () => {
                    const date = RecurringTaskService._getNthWeekdayOfMonth(
                        2025,
                        3,
                        4,
                        4
                    ); // April, Thursday, 4th
                    expect(date.getDate()).toBe(24); // April 24, 2025 is the fourth Thursday
                });
            });
        });
    });

    describe('Task Generation Tests', () => {
        describe('createTaskInstance', () => {
            it('should create a task instance with correct parent relationship', async () => {
                const template = {
                    id: 1,
                    name: 'Test Recurring Task',
                    description: 'Test description',
                    priority: 1,
                    note: 'Test note',
                    user_id: 1,
                    project_id: 2,
                };
                const dueDate = new Date('2025-01-20T10:00:00Z');

                // Mock Task.create
                const mockCreate = jest.fn().mockResolvedValue({
                    id: 10,
                    name: template.name,
                    description: template.description,
                    due_date: dueDate,
                    priority: template.priority,
                    status: 0, // NOT_STARTED
                    note: template.note,
                    user_id: template.user_id,
                    project_id: template.project_id,
                    recurrence_type: 'none',
                    recurring_parent_id: template.id,
                });
                Task.create = mockCreate;

                const result = await RecurringTaskService.createTaskInstance(
                    template,
                    dueDate
                );

                expect(mockCreate).toHaveBeenCalledWith({
                    name: template.name,
                    description: template.description,
                    due_date: dueDate,
                    today: false,
                    priority: template.priority,
                    status: 0, // Task.STATUS.NOT_STARTED
                    note: template.note,
                    user_id: template.user_id,
                    project_id: template.project_id,
                    recurrence_type: 'none',
                    recurring_parent_id: template.id,
                });

                expect(result.recurring_parent_id).toBe(template.id);
                expect(result.recurrence_type).toBe('none');
            });
        });
    });

    describe('End Date Validation', () => {
        describe('shouldGenerateNextTask', () => {
            it('should generate task when no end date is set', () => {
                const task = {
                    recurrence_type: 'daily',
                    recurrence_end_date: null,
                };
                const nextDate = new Date('2025-12-31T10:00:00Z');

                const shouldGenerate =
                    RecurringTaskService._shouldGenerateNextTask(
                        task,
                        nextDate
                    );
                expect(shouldGenerate).toBe(true);
            });

            it('should generate task when next date is before end date', () => {
                const task = {
                    recurrence_type: 'daily',
                    recurrence_end_date: new Date('2025-12-31T10:00:00Z'),
                };
                const nextDate = new Date('2025-06-15T10:00:00Z');

                const shouldGenerate =
                    RecurringTaskService._shouldGenerateNextTask(
                        task,
                        nextDate
                    );
                expect(shouldGenerate).toBe(true);
            });

            it('should not generate task when next date is after end date', () => {
                const task = {
                    recurrence_type: 'daily',
                    recurrence_end_date: new Date('2025-06-15T10:00:00Z'),
                };
                const nextDate = new Date('2025-12-31T10:00:00Z');

                const shouldGenerate =
                    RecurringTaskService._shouldGenerateNextTask(
                        task,
                        nextDate
                    );
                expect(shouldGenerate).toBe(false);
            });

            it('should not generate task when next date equals end date', () => {
                const endDate = new Date('2025-06-15T10:00:00Z');
                const task = {
                    recurrence_type: 'daily',
                    recurrence_end_date: endDate,
                };
                const nextDate = new Date('2025-06-15T10:00:00Z');

                const shouldGenerate =
                    RecurringTaskService._shouldGenerateNextTask(
                        task,
                        nextDate
                    );
                expect(shouldGenerate).toBe(false);
            });
        });
    });

    describe('Service Interface', () => {
        it('should export all required methods', () => {
            expect(typeof RecurringTaskService.generateRecurringTasks).toBe(
                'function'
            );
            expect(typeof RecurringTaskService.processRecurringTask).toBe(
                'function'
            );
            expect(typeof RecurringTaskService.calculateNextDueDate).toBe(
                'function'
            );
            expect(typeof RecurringTaskService.createTaskInstance).toBe(
                'function'
            );
            expect(typeof RecurringTaskService.handleTaskCompletion).toBe(
                'function'
            );
        });

        it('should have helper functions for testing', () => {
            expect(typeof RecurringTaskService._getFirstWeekdayOfMonth).toBe(
                'function'
            );
            expect(typeof RecurringTaskService._getLastWeekdayOfMonth).toBe(
                'function'
            );
            expect(typeof RecurringTaskService._getNthWeekdayOfMonth).toBe(
                'function'
            );
            expect(typeof RecurringTaskService._shouldGenerateNextTask).toBe(
                'function'
            );
        });
    });
});
