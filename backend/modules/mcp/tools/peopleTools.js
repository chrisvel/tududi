'use strict';

const peopleRepository = require('../../people/repository');

function registerPeopleTools(server, context, tools) {
    // 1. list_people - List people/contacts
    tools.push({
        name: 'list_people',
        description: 'List people (contacts) with optional filtering',
        inputSchema: {
            type: 'object',
            properties: {
                archived: {
                    type: 'boolean',
                    description: 'Include archived contacts (default: false)',
                    default: false,
                },
                relationship_type: {
                    type: 'string',
                    description:
                        'Filter by relationship type (e.g. colleague, friend, family, other)',
                },
                sort: {
                    type: 'string',
                    enum: ['name', 'created_at'],
                    description: 'Sort order (default: name)',
                    default: 'name',
                },
            },
        },
        handler: async (params) => {
            const people = await peopleRepository.findAllByUser(
                context.userId,
                {
                    archived: params.archived || false,
                    sort: params.sort || 'name',
                    relationship_type: params.relationship_type,
                }
            );

            const serialized = people.map((p) => ({
                id: p.id,
                uid: p.uid,
                name: p.name,
                email: p.email,
                phone: p.phone,
                relationship_type: p.relationship_type,
                notes: p.notes,
                archived: p.archived,
                color: p.color,
                created_at: p.created_at,
                updated_at: p.updated_at,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: serialized.length, people: serialized },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_person - Get a single person by UID
    tools.push({
        name: 'get_person',
        description: 'Get a specific person/contact by their UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Person UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const person = await peopleRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!person) {
                throw new Error(`Person not found: ${params.uid}`);
            }

            const assignedTaskCount = await peopleRepository.countAssignedTasks(
                person.uid
            );

            const serialized = {
                id: person.id,
                uid: person.uid,
                name: person.name,
                email: person.email,
                phone: person.phone,
                relationship_type: person.relationship_type,
                notes: person.notes,
                archived: person.archived,
                color: person.color,
                assigned_task_count: assignedTaskCount,
                created_at: person.created_at,
                updated_at: person.updated_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ person: serialized }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_person - Create a new person/contact
    tools.push({
        name: 'create_person',
        description: 'Create a new person/contact',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Full name (required)',
                },
                email: {
                    type: 'string',
                    description: 'Email address',
                },
                phone: {
                    type: 'string',
                    description: 'Phone number',
                },
                relationship_type: {
                    type: 'string',
                    description:
                        'Relationship type: colleague, friend, family, other (default: other)',
                },
                notes: {
                    type: 'string',
                    description: 'Free-text notes about this person',
                },
                color: {
                    type: 'string',
                    description:
                        'Hex color for visual identification (e.g. #ff6b6b)',
                },
            },
            required: ['name'],
        },
        handler: async (params) => {
            if (!params.name || params.name.trim().length === 0) {
                throw new Error('Person name is required');
            }

            const nameExists = await peopleRepository.nameExists(
                context.userId,
                params.name.trim()
            );
            if (nameExists) {
                throw new Error(
                    `A person named "${params.name.trim()}" already exists`
                );
            }

            const person = await peopleRepository.create({
                user_id: context.userId,
                name: params.name.trim(),
                email: params.email || null,
                phone: params.phone || null,
                relationship_type: params.relationship_type || 'other',
                notes: params.notes || null,
                color: params.color || null,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Person created successfully',
                                person: {
                                    id: person.id,
                                    uid: person.uid,
                                    name: person.name,
                                    email: person.email,
                                    phone: person.phone,
                                    relationship_type: person.relationship_type,
                                    created_at: person.created_at,
                                },
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_person - Update an existing person/contact
    tools.push({
        name: 'update_person',
        description: 'Update an existing person/contact',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Person UID (required)',
                },
                name: {
                    type: 'string',
                    description: 'New name',
                },
                email: {
                    type: 'string',
                    description: 'New email address',
                },
                phone: {
                    type: 'string',
                    description: 'New phone number',
                },
                relationship_type: {
                    type: 'string',
                    description: 'New relationship type',
                },
                notes: {
                    type: 'string',
                    description: 'New notes',
                },
                color: {
                    type: 'string',
                    description: 'New hex color or empty string to remove',
                },
                archived: {
                    type: 'boolean',
                    description: 'Archive or unarchive this person',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const person = await peopleRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!person) {
                throw new Error(`Person not found: ${params.uid}`);
            }

            if (params.name !== undefined && params.name !== person.name) {
                const nameExists = await peopleRepository.nameExists(
                    context.userId,
                    params.name.trim(),
                    params.uid
                );
                if (nameExists) {
                    throw new Error(
                        `A person named "${params.name.trim()}" already exists`
                    );
                }
            }

            const updates = {};
            if (params.name !== undefined) updates.name = params.name.trim();
            if (params.email !== undefined)
                updates.email = params.email || null;
            if (params.phone !== undefined)
                updates.phone = params.phone || null;
            if (params.relationship_type !== undefined)
                updates.relationship_type = params.relationship_type;
            if (params.notes !== undefined)
                updates.notes = params.notes || null;
            if (params.color !== undefined)
                updates.color = params.color === '' ? null : params.color;
            if (params.archived !== undefined)
                updates.archived = params.archived;

            await peopleRepository.update(person, updates);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Person updated successfully',
                                person: {
                                    id: person.id,
                                    uid: person.uid,
                                    name: person.name,
                                    updated_at: person.updated_at,
                                },
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_person - Delete a person/contact
    tools.push({
        name: 'delete_person',
        description: 'Delete a person/contact permanently',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Person UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const person = await peopleRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!person) {
                throw new Error(`Person not found: ${params.uid}`);
            }

            await peopleRepository.delete(person);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Person deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerPeopleTools };
