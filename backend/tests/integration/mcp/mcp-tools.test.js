'use strict';

const request = require('supertest');
const app = require('../../../app');
const {
    User,
    Task,
    Project,
    Area,
    Tag,
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
            it('should return empty list when no tags exist', async () => {
                const response = await callMcpTool(
                    apiTokenValue,
                    'list_tags',
                    {}
                );

                expect(response.status).toBe(200);
                const { content } = getToolContent(response);
                expect(content.count).toBe(0);
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
            expect(toolNames).toContain('create_project');
            expect(toolNames).toContain('update_project');
            expect(toolNames).toContain('list_inbox');
            expect(toolNames).toContain('add_to_inbox');
            expect(toolNames).toContain('list_areas');
            expect(toolNames).toContain('list_tags');
            expect(toolNames).toContain('search');
        });
    });
});
