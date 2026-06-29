'use strict';

const request = require('supertest');
const app = require('../../../app');
const {
    User,
    Task,
    Project,
    Area,
    Tag,
    Note,
    InboxItem,
} = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const {
    createApiToken: createApiTokenFromService,
} = require('../../../modules/users/apiTokenService');

// Parse the SSE response text into a JSON-RPC object.
// The MCP StreamableHTTP transport returns responses as SSE events:
//   event: message
//   data: {"jsonrpc":"2.0","id":1,"result":{...}}
function parseSseResponse(text) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('data: ')) {
            try {
                return JSON.parse(lines[i].slice(6));
            } catch {
                continue;
            }
        }
    }
    return null;
}

// Extract the tool result content (parsed JSON string from content[0].text).
// Returns { content, isError } for flexible assertions.
function getToolContent(response) {
    const jsonRpc = parseSseResponse(response.text);
    if (!jsonRpc || !jsonRpc.result) {
        throw new Error(
            `Unexpected MCP response: ${response.text.slice(0, 200)}`
        );
    }
    const isError = jsonRpc.result.isError === true;
    let content = null;
    if (jsonRpc.result.content && jsonRpc.result.content[0]) {
        try {
            content = JSON.parse(jsonRpc.result.content[0].text);
        } catch {
            // Content is a plain error string, not JSON
            content = { _rawError: jsonRpc.result.content[0].text };
        }
    }
    return { content, isError };
}

describe('MCP Tools Integration', () => {
    let user, apiTokenValue;
    let originalEnv;

    beforeAll(() => {
        originalEnv = process.env.FF_ENABLE_MCP;
        process.env.FF_ENABLE_MCP = 'true';
    });

    afterAll(() => {
        if (originalEnv === undefined) {
            delete process.env.FF_ENABLE_MCP;
        } else {
            process.env.FF_ENABLE_MCP = originalEnv;
        }
    });

    async function createApiToken(userId) {
        const { rawToken } = await createApiTokenFromService({
            userId,
            name: 'MCP Test Token',
            expiresAt: null,
        });
        return rawToken;
    }

    async function callMcpTool(tokenValue, toolName, params = {}) {
        return request(app)
            .post('/api/mcp')
            .set('Authorization', `Bearer ${tokenValue}`)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json, text/event-stream')
            .send({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: params,
                },
                id: 1,
            });
    }

    beforeEach(async () => {
        user = await createTestUser({
            email: `mcp_tool_test_${Date.now()}@example.com`,
        });
        apiTokenValue = await createApiToken(user.id);
    });

    describe('Task Tools', () => {
        describe('list_tasks', () => {
            it('should return empty list when no tasks exist', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tasks',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBe(0);
                expect(content.tasks).toEqual([]);
            });

            it('should return tasks when they exist', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Test Task',
                    status: 0,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tasks',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBeGreaterThanOrEqual(1);
            });

            it('should filter tasks by status', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Pending Task',
                    status: 0,
                });
                await Task.create({
                    user_id: user.id,
                    name: 'Completed Task',
                    status: 2,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tasks',
                    { status: 'pending' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.tasks.every((t) => t.status === 0)).toBe(true);
            });

            it('should filter tasks by type', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Completed Task',
                    status: 2,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tasks',
                    { type: 'completed' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.tasks.every((t) => t.status === 2)).toBe(true);
            });
        });

        describe('create_task', () => {
            it('should create a task with required fields', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_task',
                    {
                        name: 'New Task from MCP',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Task created successfully');
                expect(content.task.name).toBe('New Task from MCP');
                expect(content.task.status).toBe(0); // pending
            });

            it('should create a task with priority', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_task',
                    {
                        name: 'High Priority Task',
                        priority: 'high',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.task.priority).toBe(2); // high = 2
            });

            it('should create a task with description', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_task',
                    {
                        name: 'Task with Note',
                        description: 'This is a detailed note',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.task.note).toBe('This is a detailed note');
            });

            it('should create a task with due date', async () => {
                const dueDate = new Date(Date.now() + 86400000).toISOString();
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_task',
                    {
                        name: 'Task with Due Date',
                        due_date: dueDate,
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.task.due_date).toBeDefined();
            });
        });

        describe('get_task', () => {
            it('should return task by numeric ID', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Findable Task',
                    status: 0,
                });

                const response = await callMcpTool(apiTokenValue, 'get_task', {
                    id: task.id,
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.name).toBe('Findable Task');
            });

            it('should return task by UID', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Findable by UID',
                    status: 0,
                });

                const response = await callMcpTool(apiTokenValue, 'get_task', {
                    id: task.uid,
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.name).toBe('Findable by UID');
            });

            it('should throw error for non-existent task', async () => {
                const response = await callMcpTool(apiTokenValue, 'get_task', {
                    id: 999999,
                });

                expect(response.status).toBe(200);
                const jsonRpc = parseSseResponse(response.text);
                expect(jsonRpc.result.isError).toBe(true);
            });

            it('should deny access to other user tasks', async () => {
                const otherUser = await createTestUser({
                    email: `other_${Date.now()}@example.com`,
                });
                const otherTask = await Task.create({
                    user_id: otherUser.id,
                    name: 'Secret Task',
                    status: 0,
                });

                const response = await callMcpTool(apiTokenValue, 'get_task', {
                    id: otherTask.id,
                });

                expect(response.status).toBe(200);
                const jsonRpc = parseSseResponse(response.text);
                expect(jsonRpc.result.isError).toBe(true);
            });
        });

        describe('update_task', () => {
            it('should update task name', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Old Name',
                    status: 0,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'update_task',
                    {
                        id: task.id,
                        name: 'New Name',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.task.name).toBe('New Name');
            });

            it('should update task status', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Status Change Task',
                    status: 0,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'update_task',
                    {
                        id: task.id,
                        status: 'in_progress',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.task.status).toBe(1); // in_progress = 1
            });
        });

        describe('complete_task', () => {
            it('should mark task as completed', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'To Complete',
                    status: 0,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'complete_task',
                    { id: task.id }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Task completed');
                expect(content.task.status).toBe(2); // completed = 2
            });

            it('should reopen completed task', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Reopen Me',
                    status: 2,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'complete_task',
                    { id: task.id }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Task reopened');
                expect(content.task.status).toBe(0); // pending = 0
            });
        });

        describe('delete_task', () => {
            it('should delete a task', async () => {
                const task = await Task.create({
                    user_id: user.id,
                    name: 'Delete Me',
                    status: 0,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'delete_task',
                    { id: task.id }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Task deleted successfully');

                // Verify task is gone
                const deletedTask = await Task.findByPk(task.id);
                expect(deletedTask).toBeNull();
            });
        });

        describe('add_subtask', () => {
            it('should create subtask under parent', async () => {
                const parent = await Task.create({
                    user_id: user.id,
                    name: 'Parent Task',
                    status: 0,
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'add_subtask',
                    {
                        parent_id: parent.id,
                        name: 'Child Subtask',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Subtask created successfully');
                expect(content.subtask.name).toBe('Child Subtask');
            });
        });

        describe('get_task_metrics', () => {
            it('should return task statistics', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Open Task',
                    status: 0,
                });
                await Task.create({
                    user_id: user.id,
                    name: 'Completed Task',
                    status: 2,
                    completed_at: new Date(),
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'get_task_metrics',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.open_tasks).toBeGreaterThanOrEqual(1);
                expect(content.completed_tasks).toBeGreaterThanOrEqual(1);
                expect(content.overdue_tasks).toBeDefined();
                expect(content.in_progress_tasks).toBeDefined();
            });
        });
    });

    describe('Project Tools', () => {
        describe('list_projects', () => {
            it('should return empty list when no projects exist', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_projects',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBe(0);
            });

            it('should return projects with correct fields', async () => {
                await Project.create({
                    user_id: user.id,
                    name: 'Test Project',
                    status: 'planned',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_projects',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBeGreaterThanOrEqual(1);
                expect(content.projects[0]).toHaveProperty('name');
                expect(content.projects[0]).toHaveProperty('status');
            });
        });

        describe('create_project', () => {
            it('should create a project with required fields', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_project',
                    { name: 'New MCP Project' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Project created successfully');
                expect(content.project.name).toBe('New MCP Project');
                expect(content.project.status).toBe('not_started');
            });

            it('should create a project with status and priority', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_project',
                    {
                        name: 'Prioritized Project',
                        status: 'in_progress',
                        priority: 2,
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.project.status).toBe('in_progress');
                expect(content.project.priority).toBe(2);
            });
        });

        describe('update_project', () => {
            it('should update project by UID', async () => {
                const project = await Project.create({
                    user_id: user.id,
                    name: 'Old Project Name',
                    status: 'not_started',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'update_project',
                    {
                        uid: project.uid,
                        name: 'Updated Name',
                        status: 'in_progress',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Project updated successfully');
                expect(content.project.name).toBe('Updated Name');
                expect(content.project.status).toBe('in_progress');
            });

            it('should throw error for non-existent project', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'update_project',
                    {
                        uid: 'non-existent-uid',
                        name: 'Updated',
                    }
                );

                expect(response.status).toBe(200);
                const jsonRpc = parseSseResponse(response.text);
                expect(jsonRpc.result.isError).toBe(true);
            });
        });

        describe('get_project', () => {
            it('should return a project by UID', async () => {
                const project = await Project.create({
                    user_id: user.id,
                    name: 'Fetchable Project',
                    status: 'planned',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'get_project',
                    { uid: project.uid }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.project.name).toBe('Fetchable Project');
                expect(content.project.uid).toBe(project.uid);
            });

            it('should error for non-existent project', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'get_project',
                    { uid: 'non-existent-uid' }
                );

                const { isError } = getToolContent(response);
                expect(isError).toBe(true);
            });
        });

        describe('delete_project', () => {
            it('should delete a project by UID', async () => {
                const project = await Project.create({
                    user_id: user.id,
                    name: 'Doomed Project',
                    status: 'not_started',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'delete_project',
                    { uid: project.uid }
                );

                expect(response.status).toBe(200);
                const deleted = await Project.findByPk(project.id);
                expect(deleted).toBeNull();
            });
        });
    });

    describe('Inbox Tools', () => {
        describe('list_inbox', () => {
            it('should return empty inbox', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_inbox',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBe(0);
                expect(content.items).toEqual([]);
            });

            it('should return inbox items', async () => {
                await InboxItem.create({
                    user_id: user.id,
                    content: 'Test Inbox Item',
                    source: 'mcp',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_inbox',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBeGreaterThanOrEqual(1);
            });
        });

        describe('add_to_inbox', () => {
            it('should add item to inbox', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'add_to_inbox',
                    { content: 'Captured from MCP' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe(
                    'Item added to inbox successfully'
                );
                expect(content.item.content).toBe('Captured from MCP');
                expect(content.item.source).toBe('mcp');
            });

            it('should allow custom source', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'add_to_inbox',
                    { content: 'Custom source item', source: 'custom-app' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.item.source).toBe('custom-app');
            });
        });

        describe('get_inbox_item', () => {
            it('should return an inbox item by UID', async () => {
                const item = await InboxItem.create({
                    user_id: user.id,
                    content: 'Fetch me',
                    source: 'mcp',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'get_inbox_item',
                    { uid: item.uid }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.item.content).toBe('Fetch me');
            });

            it('should error for non-existent item', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'get_inbox_item',
                    { uid: 'non-existent-uid' }
                );

                const { isError } = getToolContent(response);
                expect(isError).toBe(true);
            });
        });

        describe('update_inbox_item', () => {
            it('should update inbox item content', async () => {
                const item = await InboxItem.create({
                    user_id: user.id,
                    content: 'Original',
                    source: 'mcp',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'update_inbox_item',
                    { uid: item.uid, content: 'Edited' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.item.content).toBe('Edited');

                await item.reload();
                expect(item.content).toBe('Edited');
            });
        });

        describe('process_inbox_item', () => {
            it('should mark an inbox item as processed', async () => {
                const item = await InboxItem.create({
                    user_id: user.id,
                    content: 'To process',
                    source: 'mcp',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'process_inbox_item',
                    { uid: item.uid }
                );

                expect(response.status).toBe(200);
                await item.reload();
                expect(item.status).toBe('processed');
            });
        });

        describe('delete_inbox_item', () => {
            it('should delete an inbox item', async () => {
                const item = await InboxItem.create({
                    user_id: user.id,
                    content: 'To delete',
                    source: 'mcp',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'delete_inbox_item',
                    { uid: item.uid }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Inbox item deleted successfully');

                // Soft-deleted: no longer active
                await item.reload();
                expect(item.status).toBe('deleted');
            });
        });
    });

    describe('Note Tools', () => {
        describe('list_notes', () => {
            it('should return empty list when no notes exist', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_notes',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBe(0);
            });

            it('should return user notes', async () => {
                await Note.create({
                    user_id: user.id,
                    title: 'My Note',
                    content: 'Some content',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_notes',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBeGreaterThanOrEqual(1);
                expect(content.notes.some((n) => n.title === 'My Note')).toBe(
                    true
                );
            });
        });

        describe('get_note', () => {
            it('should return a note by UID', async () => {
                const note = await Note.create({
                    user_id: user.id,
                    title: 'Fetchable Note',
                    content: 'body',
                });

                const response = await callMcpTool(apiTokenValue, 'get_note', {
                    uid: note.uid,
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.note.title).toBe('Fetchable Note');
            });

            it('should error for non-existent note', async () => {
                const response = await callMcpTool(apiTokenValue, 'get_note', {
                    uid: 'non-existent-uid',
                });

                const { isError } = getToolContent(response);
                expect(isError).toBe(true);
            });
        });

        describe('create_note', () => {
            it('should create a new note', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_note',
                    { title: 'Created Note', content: 'Hello' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.message).toBe('Note created successfully');
                expect(content.note.title).toBe('Created Note');

                const created = await Note.findOne({
                    where: { user_id: user.id, title: 'Created Note' },
                });
                expect(created).not.toBeNull();
            });

            it('should create a note with tags', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_note',
                    { title: 'Tagged Note', tags: ['ideas'] }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.note.Tags.some((t) => t.name === 'ideas')).toBe(
                    true
                );
            });
        });

        describe('update_note', () => {
            it('should update a note title and content', async () => {
                const note = await Note.create({
                    user_id: user.id,
                    title: 'Old Title',
                    content: 'old',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'update_note',
                    {
                        uid: note.uid,
                        title: 'New Title',
                        content: 'new',
                    }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.note.title).toBe('New Title');

                await note.reload();
                expect(note.title).toBe('New Title');
                expect(note.content).toBe('new');
            });
        });

        describe('delete_note', () => {
            it('should delete a note', async () => {
                const note = await Note.create({
                    user_id: user.id,
                    title: 'To Delete',
                    content: 'bye',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'delete_note',
                    { uid: note.uid }
                );

                expect(response.status).toBe(200);
                const deleted = await Note.findByPk(note.id);
                expect(deleted).toBeNull();
            });
        });
    });

    describe('Misc Tools', () => {
        describe('list_areas', () => {
            it('should return empty list when no areas exist', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_areas',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBe(0);
            });

            it('should return user areas', async () => {
                await Area.create({
                    user_id: user.id,
                    name: 'Work',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_areas',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBeGreaterThanOrEqual(1);
                const workArea = content.areas.find((a) => a.name === 'Work');
                expect(workArea).toBeDefined();
            });
        });

        describe('list_tags', () => {
            it('should return only system tags when no user tags exist', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tags',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                // 'someday' and 'today' system tags are auto-created for every new user
                expect(content.count).toBe(2);
                expect(content.tags.map((t) => t.name)).toContain('someday');
                expect(content.tags.map((t) => t.name)).toContain('today');
            });

            it('should return user tags', async () => {
                await Tag.create({
                    user_id: user.id,
                    name: 'urgent',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tags',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBeGreaterThanOrEqual(1);
                expect(content.tags.some((t) => t.name === 'urgent')).toBe(
                    true
                );
            });
        });

        describe('get_tag', () => {
            it('should return a tag by uid', async () => {
                const tag = await Tag.create({
                    user_id: user.id,
                    name: 'focus',
                });

                const response = await callMcpTool(apiTokenValue, 'get_tag', {
                    uid: tag.uid,
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.tag.name).toBe('focus');
            });

            it('should return a tag by name', async () => {
                await Tag.create({
                    user_id: user.id,
                    name: 'reading',
                });

                const response = await callMcpTool(apiTokenValue, 'get_tag', {
                    name: 'reading',
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.tag.name).toBe('reading');
            });

            it('should error when tag does not exist', async () => {
                const response = await callMcpTool(apiTokenValue, 'get_tag', {
                    uid: 'nonexistent',
                });

                const { isError } = getToolContent(response);
                expect(isError).toBe(true);
            });
        });

        describe('create_tag', () => {
            it('should create a new tag', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'create_tag',
                    { name: 'work' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.tag.name).toBe('work');

                const created = await Tag.findOne({
                    where: { user_id: user.id, name: 'work' },
                });
                expect(created).not.toBeNull();
            });

            it('should error on duplicate tag name', async () => {
                await Tag.create({ user_id: user.id, name: 'dup' });

                const response = await callMcpTool(
                    apiTokenValue,
                    'create_tag',
                    { name: 'dup' }
                );

                const { isError } = getToolContent(response);
                expect(isError).toBe(true);
            });
        });

        describe('update_tag', () => {
            it('should update a tag name', async () => {
                const tag = await Tag.create({
                    user_id: user.id,
                    name: 'old-name',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'update_tag',
                    { uid: tag.uid, name: 'new-name' }
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.tag.name).toBe('new-name');

                await tag.reload();
                expect(tag.name).toBe('new-name');
            });
        });

        describe('delete_tag', () => {
            it('should delete a tag', async () => {
                const tag = await Tag.create({
                    user_id: user.id,
                    name: 'to-delete',
                });

                const response = await callMcpTool(
                    apiTokenValue,
                    'delete_tag',
                    { uid: tag.uid }
                );

                expect(response.status).toBe(200);
                const deleted = await Tag.findByPk(tag.id);
                expect(deleted).toBeNull();
            });
        });

        describe('search', () => {
            it('should search tasks by name', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Searchable Task',
                    status: 0,
                });

                const response = await callMcpTool(apiTokenValue, 'search', {
                    query: 'Searchable',
                    type: 'task',
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.results.tasks).toBeDefined();
                expect(content.results.tasks.length).toBeGreaterThanOrEqual(1);
                expect(
                    content.results.tasks.some(
                        (t) => t.name === 'Searchable Task'
                    )
                ).toBe(true);
            });

            it('should search projects', async () => {
                await Project.create({
                    user_id: user.id,
                    name: 'Searchable Project',
                    status: 'planned',
                });

                const response = await callMcpTool(apiTokenValue, 'search', {
                    query: 'Searchable',
                    type: 'project',
                });

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.results.projects).toBeDefined();
                expect(content.results.projects.length).toBeGreaterThanOrEqual(
                    1
                );
            });

            it('should search across all types', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Universal Search Result',
                    status: 0,
                });
                await Project.create({
                    user_id: user.id,
                    name: 'Universal Search Result',
                    status: 'planned',
                });

                const response = await callMcpTool(apiTokenValue, 'search', {
                    query: 'Universal',
                    type: 'all',
                });

                expect(response.status).toBe(200);
                const { content, isError } = getToolContent(response);
                expect(isError).toBe(false);
                // Should find the project we created
                expect(content.results.projects).toBeDefined();
                expect(
                    content.results.projects.some(
                        (p) => p.name === 'Universal Search Result'
                    )
                ).toBe(true);
            });

            it('should return empty results when nothing matches', async () => {
                const response = await callMcpTool(apiTokenValue, 'search', {
                    query: 'xyznonexistent123',
                });

                expect(response.status).toBe(200);
                const { content, isError } = getToolContent(response);
                expect(isError).toBe(false);
                // Should return empty results for non-existent query
                expect(content.results.tasks.length).toBe(0);
                expect(content.results.projects.length).toBe(0);
                expect(content.results.notes.length).toBe(0);
            });
        });
    });

    describe('Tool listing via MCP protocol', () => {
        it('should list available tools via tools/list method', async () => {
            const response = await request(app)
                .post('/api/mcp')
                .set('Authorization', `Bearer ${apiTokenValue}`)
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json, text/event-stream')
                .send({
                    jsonrpc: '2.0',
                    method: 'tools/list',
                    id: 1,
                });

            expect(response.status).toBe(200);
            const jsonRpc = parseSseResponse(response.text);
            expect(jsonRpc.result.tools).toBeDefined();
            expect(jsonRpc.result.tools.length).toBeGreaterThan(0);

            const toolNames = jsonRpc.result.tools.map((t) => t.name);
            // Should have all 16 tools
            expect(toolNames).toContain('list_tasks');
            expect(toolNames).toContain('get_task');
            expect(toolNames).toContain('create_task');
            expect(toolNames).toContain('update_task');
            expect(toolNames).toContain('complete_task');
            expect(toolNames).toContain('delete_task');
            expect(toolNames).toContain('add_subtask');
            expect(toolNames).toContain('get_task_metrics');
            expect(toolNames).toContain('list_projects');
            expect(toolNames).toContain('get_project');
            expect(toolNames).toContain('create_project');
            expect(toolNames).toContain('update_project');
            expect(toolNames).toContain('list_inbox');
            expect(toolNames).toContain('add_to_inbox');
            expect(toolNames).toContain('get_inbox_item');
            expect(toolNames).toContain('update_inbox_item');
            expect(toolNames).toContain('process_inbox_item');
            expect(toolNames).toContain('delete_inbox_item');
            expect(toolNames).toContain('list_notes');
            expect(toolNames).toContain('get_note');
            expect(toolNames).toContain('create_note');
            expect(toolNames).toContain('update_note');
            expect(toolNames).toContain('delete_note');
            expect(toolNames).toContain('list_areas');
            expect(toolNames).toContain('list_tags');
            expect(toolNames).toContain('search');
        });
    });
});
