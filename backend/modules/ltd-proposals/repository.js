'use strict';
const { Op } = require('sequelize');
const { LtdProposal } = require('../../models');

module.exports = {
    create: (data, options) => LtdProposal.create(data, options),
    find: (userId, uid) =>
        LtdProposal.findOne({ where: { uid, user_id: userId } }),
    list: (userId, status) =>
        LtdProposal.findAll({
            where: { user_id: userId, ...(status ? { status } : {}) },
            order: [['id', 'DESC']],
            limit: 100,
        }),
    // Lazy expiry: pending proposals past their date can no longer be applied.
    expire: (userId, now = new Date()) =>
        LtdProposal.update(
            { status: 'expired', decided_at: now },
            {
                where: {
                    user_id: userId,
                    status: 'pending',
                    expires_at: { [Op.lt]: now },
                },
            }
        ),
    // Claims a pending proposal once, so two Apply clicks cannot both run.
    claim: async (proposal, now) => {
        const [count] = await LtdProposal.update(
            { decided_at: now },
            {
                where: {
                    id: proposal.id,
                    status: 'pending',
                    decided_at: null,
                },
            }
        );
        return count === 1;
    },
};
