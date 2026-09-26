'use strict';

const { Op } = require('sequelize');
const {
    InboxItemAttachment,
    TaskAttachment,
    sequelize,
} = require('../../models');

class InboxAttachmentsRepository {
    async findForItem(itemId) {
        return InboxItemAttachment.findAll({
            where: { inbox_item_id: itemId },
            order: [['created_at', 'ASC']],
        });
    }

    async findForItems(itemIds) {
        if (itemIds.length === 0) return [];
        return InboxItemAttachment.findAll({
            where: { inbox_item_id: { [Op.in]: itemIds } },
            order: [['created_at', 'ASC']],
        });
    }

    async findOneForItem(itemId, attachmentUid) {
        return InboxItemAttachment.findOne({
            where: { inbox_item_id: itemId, uid: attachmentUid },
        });
    }

    async countForItem(itemId) {
        return InboxItemAttachment.count({
            where: { inbox_item_id: itemId },
        });
    }

    async create(data) {
        return InboxItemAttachment.create(data);
    }

    async destroyForItem(itemId) {
        await InboxItemAttachment.destroy({ where: { inbox_item_id: itemId } });
    }

    async countForTask(taskId) {
        return TaskAttachment.count({ where: { task_id: taskId } });
    }

    // Swaps the inbox row for a task row in one transaction, so a file is
    // never listed under both or under neither.
    async moveToTask(attachment, taskId, filePath) {
        return sequelize.transaction(async (transaction) => {
            const moved = await TaskAttachment.create(
                {
                    task_id: taskId,
                    user_id: attachment.user_id,
                    original_filename: attachment.original_filename,
                    stored_filename: attachment.stored_filename,
                    file_size: attachment.file_size,
                    mime_type: attachment.mime_type,
                    file_path: filePath,
                },
                { transaction }
            );
            await attachment.destroy({ transaction });
            return moved;
        });
    }
}

module.exports = new InboxAttachmentsRepository();
