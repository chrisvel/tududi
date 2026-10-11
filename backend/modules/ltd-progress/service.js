'use strict';
const repository = require('./repository');
const cache = require('./cache');
const { project } = require('./projection');
const { NotFoundError } = require('../../shared/errors');

async function read(userId) {
    let snapshot = cache.get(userId);
    if (!snapshot) {
        const revision = cache.revision();
        snapshot = await repository.snapshot(userId);
        cache.set(userId, snapshot, revision);
    }
    return { snapshot, ...project(snapshot) };
}
async function tree(userId, filters = {}) {
    const data = await read(userId);
    const nodes = new Map(
        data.snapshot.goals
            .filter(
                (g) =>
                    (!filters.area_id || g.area_id === filters.area_id) &&
                    (!filters.status ||
                        filters.status === 'all' ||
                        g.status === filters.status)
            )
            .map((g) => [
                g.id,
                { ...g, progress: data.progress.get(g.id), children: [] },
            ])
    );
    const roots = [];
    for (const node of nodes.values()) {
        if (nodes.has(node.parent_goal_id))
            nodes.get(node.parent_goal_id).children.push(node);
        else roots.push(node);
    }
    return roots;
}
async function progress(userId, uid) {
    const data = await read(userId);
    const goal = data.snapshot.goals.find((g) => g.uid === uid);
    if (!goal) throw new NotFoundError('Goal not found');
    return data.progress.get(goal.id);
}
async function lifeVision(userId) {
    const goals = await tree(userId);
    const visions = [];
    function visit(nodes) {
        for (const node of nodes) {
            if (node.horizon === 'vision') visions.push(node);
            else visit(node.children);
        }
    }
    visit(goals);
    return visions;
}
async function whyChain(userId, uid) {
    const data = await read(userId);
    const task = data.snapshot.tasks.find((t) => t.uid === uid);
    if (!task) throw new NotFoundError('Task not found');
    return data.chain(
        task.goal_id ?? data.projectById.get(task.project_id)?.goal_id
    );
}
module.exports = {
    tree,
    progress,
    lifeVision,
    whyChain,
    invalidate: cache.invalidate,
};
