'use strict';

const taskRepository = require('../../tasks/repository');
const commentsService = require('../../comments/service');

// Access is checked by the comments service, this just resolves the uid.
// Same message as the service so a missing task and someone else's task
// look identical to the caller.
async function resolveTaskUid(identifier) {
    const options = { attributes: ['id', 'uid'] };
    const task = isNaN(identifier)
        ? await taskRepository.findByUid(identifier, options)
        : await taskRepository.findById(parseInt(identifier), options);
    if (!task) {
        throw new Error('Task not found');
    }
    return task.uid;
}

function registerCommentTools(server, context, tools) {
    // 1. list_task_comments - List the comment thread on a task
    tools.push({
        name: 'list_task_comments',
        description:
            'List the comments on a task, oldest first. Replies are nested under the comment they answer.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: ['number', 'string'],
                    description: 'Task ID (number) or UID (string)',
                },
            },
            required: ['id'],
        },
        handler: async (params) => {
            const taskUid = await resolveTaskUid(params.id);
            const comments = await commentsService.listComments(
                context.userId,
                taskUid
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: comments.length, comments },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. add_task_comment - Post a comment or a reply on a task
    tools.push({
        name: 'add_task_comment',
        description:
            'Add a comment to a task. Read access to the task is enough. Pass parent_comment_uid to reply to a top-level comment.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: ['number', 'string'],
                    description: 'Task ID (number) or UID (string)',
                },
                body: {
                    type: 'string',
                    description: 'Comment text (required)',
                },
                parent_comment_uid: {
                    type: 'string',
                    description:
                        'UID of the comment to reply to (optional, replies cannot be nested further)',
                },
                mentioned_person_uids: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                        'Person UIDs mentioned in the comment; they get notified (optional)',
                },
            },
            required: ['id', 'body'],
        },
        handler: async (params) => {
            const taskUid = await resolveTaskUid(params.id);
            const comment = await commentsService.addComment(
                context.userId,
                taskUid,
                {
                    body: params.body,
                    mentionedPersonUids: params.mentioned_person_uids,
                    parentCommentUid: params.parent_comment_uid,
                }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Comment added', comment },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerCommentTools };
