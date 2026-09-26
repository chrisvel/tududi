'use strict';

const request = require('supertest');
const app = require('../../../app');
const { Project, Person } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const rolesService = require('../../../services/rolesService');
const {
    createApiToken: createApiTokenFromService,
} = require('../../../modules/users/apiTokenService');

function parseSseResponse(text) {
    for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
            try {
                return JSON.parse(line.slice(6));
            } catch {
                continue;
            }
        }
    }
    return null;
}

function getToolResult(response) {
    const rpc = parseSseResponse(response.text);
    if (!rpc || !rpc.result) {
        throw new Error(
            `Unexpected MCP response: ${response.text.slice(0, 200)}`
        );
    }
    const text = rpc.result.content && rpc.result.content[0].text;
    return { isError: rpc.result.isError === true, text };
}

describe('MCP tools respect the account role', () => {
    let admin, member, guest;
    let memberToken, guestToken;

    const tokenFor = async (userId) =>
        (
            await createApiTokenFromService({
                userId,
                name: 'MCP roles test',
                expiresAt: null,
            })
        ).rawToken;

    const callTool = (token, name, args) =>
        request(app)
            .post('/api/mcp')
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json, text/event-stream')
            .send({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: { name, arguments: args },
                id: 1,
            });

    beforeEach(async () => {
        admin = await createTestUser({ email: 'admin@example.com' });
        member = await createTestUser({ email: 'member@example.com' });
        guest = await createTestUser({ email: 'guest@example.com' });
        await rolesService.setRole(guest.id, 'guest');
        memberToken = await tokenFor(member.id);
        guestToken = await tokenFor(guest.id);
    });

    it('lets a user create a project and a person', async () => {
        const project = getToolResult(
            await callTool(memberToken, 'create_project', { name: 'Garden' })
        );
        const person = getToolResult(
            await callTool(memberToken, 'create_person', { name: 'Plumber' })
        );

        expect(project.isError).toBe(false);
        expect(person.isError).toBe(false);
        expect(await Project.count({ where: { user_id: member.id } })).toBe(1);
        expect(await Person.count({ where: { name: 'Plumber' } })).toBe(1);
    });

    it('refuses a guest a new project', async () => {
        const result = getToolResult(
            await callTool(guestToken, 'create_project', { name: 'Garden' })
        );

        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/role does not allow/i);
        expect(await Project.count({ where: { user_id: guest.id } })).toBe(0);
    });

    it('refuses a guest a new person', async () => {
        const result = getToolResult(
            await callTool(guestToken, 'create_person', { name: 'Plumber' })
        );

        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/role does not allow/i);
        expect(await Person.count({ where: { name: 'Plumber' } })).toBe(0);
    });

    it('follows a capability taken away from one user', async () => {
        await rolesService.setCapabilities(member.id, {
            create_projects: false,
        });

        const project = getToolResult(
            await callTool(memberToken, 'create_project', { name: 'Garden' })
        );
        const person = getToolResult(
            await callTool(memberToken, 'create_person', { name: 'Ann' })
        );

        expect(project.isError).toBe(true);
        expect(person.isError).toBe(false);
    });
});
