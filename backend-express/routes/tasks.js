const express = require('express');
const { Task, Tag, Project, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Helper function to update task tags
async function updateTaskTags(task, tagsData, userId) {
  if (!tagsData) return;

  const tagNames = tagsData
    .map(tag => tag.name)
    .filter(name => name && name.trim())
    .filter((name, index, arr) => arr.indexOf(name) === index); // unique

  if (tagNames.length === 0) {
    await task.setTags([]);
    return;
  }

  // Find existing tags
  const existingTags = await Tag.findAll({
    where: { user_id: userId, name: tagNames }
  });

  // Create new tags
  const existingTagNames = existingTags.map(tag => tag.name);
  const newTagNames = tagNames.filter(name => !existingTagNames.includes(name));
  
  const createdTags = await Promise.all(
    newTagNames.map(name => Tag.create({ name, user_id: userId }))
  );

  // Set all tags to task
  const allTags = [...existingTags, ...createdTags];
  await task.setTags(allTags);
}

// Filter tasks by parameters
async function filterTasksByParams(params, userId) {
  let whereClause = { user_id: userId };
  let includeClause = [
    { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } },
    { model: Project, attributes: ['name'], required: false }
  ];

  // Filter by type
  switch (params.type) {
    case 'today':
      // Just user tasks, no additional filtering
      break;
    case 'upcoming':
      whereClause.due_date = {
        [Op.between]: [new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      };
      whereClause.status = { [Op.ne]: Task.STATUS.DONE };
      break;
    case 'next':
      whereClause.due_date = null;
      whereClause.project_id = null;
      whereClause.status = { [Op.ne]: Task.STATUS.DONE };
      break;
    case 'inbox':
      whereClause[Op.or] = [
        { due_date: null },
        { project_id: null }
      ];
      whereClause.status = { [Op.ne]: Task.STATUS.DONE };
      break;
    case 'someday':
      whereClause.due_date = null;
      whereClause.status = { [Op.ne]: Task.STATUS.DONE };
      break;
    case 'waiting':
      whereClause.status = Task.STATUS.WAITING;
      break;
    default:
      if (params.status === 'done') {
        whereClause.status = Task.STATUS.DONE;
      } else {
        whereClause.status = { [Op.ne]: Task.STATUS.DONE };
      }
  }

  // Filter by tag
  if (params.tag) {
    includeClause[0].where = { name: params.tag };
    includeClause[0].required = true;
  }

  let orderClause = [['created_at', 'ASC']];

  // Apply ordering
  if (params.order_by) {
    const [orderColumn, orderDirection = 'asc'] = params.order_by.split(':');
    const allowedColumns = ['created_at', 'updated_at', 'name', 'priority', 'status', 'due_date'];
    
    if (!allowedColumns.includes(orderColumn)) {
      throw new Error('Invalid order column specified.');
    }

    if (orderColumn === 'due_date') {
      orderClause = [
        [sequelize.literal('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END'), 'ASC'],
        ['due_date', orderDirection.toUpperCase()]
      ];
    } else {
      orderClause = [[orderColumn, orderDirection.toUpperCase()]];
    }
  }

  return await Task.findAll({
    where: whereClause,
    include: includeClause,
    order: orderClause,
    distinct: true
  });
}

// Compute task metrics
async function computeTaskMetrics(userId) {
  const totalOpenTasks = await Task.count({
    where: { user_id: userId, status: { [Op.ne]: Task.STATUS.DONE } }
  });

  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const tasksPendingOverMonth = await Task.count({
    where: {
      user_id: userId,
      status: { [Op.ne]: Task.STATUS.DONE },
      created_at: { [Op.lt]: oneMonthAgo }
    }
  });

  const tasksInProgress = await Task.findAll({
    where: {
      user_id: userId,
      status: Task.STATUS.IN_PROGRESS
    },
    include: [
      { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } },
      { model: Project, attributes: ['name'], required: false }
    ],
    order: [['priority', 'DESC']]
  });

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const tasksDueToday = await Task.findAll({
    where: {
      user_id: userId,
      status: { [Op.ne]: Task.STATUS.DONE },
      [Op.or]: [
        { due_date: { [Op.lte]: today } },
        sequelize.literal(`EXISTS (
          SELECT 1 FROM projects 
          WHERE projects.id = Task.project_id 
          AND projects.due_date_at <= '${today.toISOString()}'
        )`)
      ]
    },
    include: [
      { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } },
      { model: Project, attributes: ['name'], required: false }
    ]
  });

  // Get suggested tasks (simplified version)
  const excludedTaskIds = [
    ...tasksInProgress.map(t => t.id),
    ...tasksDueToday.map(t => t.id)
  ];

  const suggestedTasks = await Task.findAll({
    where: {
      user_id: userId,
      status: Task.STATUS.NOT_STARTED,
      id: { [Op.notIn]: excludedTaskIds }
    },
    include: [
      { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } },
      { model: Project, attributes: ['name'], required: false }
    ],
    order: [['priority', 'DESC']],
    limit: 10
  });

  return {
    total_open_tasks: totalOpenTasks,
    tasks_pending_over_month: tasksPendingOverMonth,
    tasks_in_progress_count: tasksInProgress.length,
    tasks_in_progress: tasksInProgress,
    tasks_due_today: tasksDueToday,
    suggested_tasks: suggestedTasks
  };
}

// GET /api/tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await filterTasksByParams(req.query, req.currentUser.id);
    const metrics = await computeTaskMetrics(req.currentUser.id);

    res.json({
      tasks: tasks.map(task => ({
        ...task.toJSON(),
        due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
      })),
      metrics: {
        total_open_tasks: metrics.total_open_tasks,
        tasks_pending_over_month: metrics.tasks_pending_over_month,
        tasks_in_progress_count: metrics.tasks_in_progress_count,
        tasks_in_progress: metrics.tasks_in_progress.map(task => ({
          ...task.toJSON(),
          due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
        })),
        tasks_due_today: metrics.tasks_due_today.map(task => ({
          ...task.toJSON(),
          due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
        })),
        suggested_tasks: metrics.suggested_tasks.map(task => ({
          ...task.toJSON(),
          due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    if (error.message === 'Invalid order column specified.') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/task
router.post('/task', async (req, res) => {
  try {
    const { name, priority, due_date, status, note, project_id, tags } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Task name is required.' });
    }

    const taskAttributes = {
      name: name.trim(),
      priority: priority || Task.PRIORITY.LOW,
      due_date: due_date || null,
      status: status || Task.STATUS.NOT_STARTED,
      note,
      user_id: req.currentUser.id
    };

    // Handle project assignment
    if (project_id && project_id.toString().trim()) {
      const project = await Project.findOne({
        where: { id: project_id, user_id: req.currentUser.id }
      });
      if (!project) {
        return res.status(400).json({ error: 'Invalid project.' });
      }
      taskAttributes.project_id = project_id;
    }

    const task = await Task.create(taskAttributes);
    await updateTaskTags(task, tags, req.currentUser.id);

    // Reload task with associations
    const taskWithAssociations = await Task.findByPk(task.id, {
      include: [
        { model: Tag, attributes: ['name'], through: { attributes: [] } },
        { model: Project, attributes: ['name'], required: false }
      ]
    });

    res.status(201).json({
      ...taskWithAssociations.toJSON(),
      due_date: taskWithAssociations.due_date ? taskWithAssociations.due_date.toISOString().split('T')[0] : null
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(400).json({ 
      error: 'There was a problem creating the task.', 
      details: error.errors ? error.errors.map(e => e.message) : [error.message]
    });
  }
});

// PATCH /api/task/:id
router.patch('/task/:id', async (req, res) => {
  try {
    const { name, priority, status, note, due_date, project_id, tags } = req.body;

    const task = await Task.findOne({
      where: { id: req.params.id, user_id: req.currentUser.id }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const taskAttributes = {
      name,
      priority,
      status: status || Task.STATUS.NOT_STARTED,
      note,
      due_date: due_date || null
    };

    // Handle project assignment
    if (project_id && project_id.toString().trim()) {
      const project = await Project.findOne({
        where: { id: project_id, user_id: req.currentUser.id }
      });
      if (!project) {
        return res.status(400).json({ error: 'Invalid project.' });
      }
      taskAttributes.project_id = project_id;
    } else {
      taskAttributes.project_id = null;
    }

    await task.update(taskAttributes);
    await updateTaskTags(task, tags, req.currentUser.id);

    // Reload task with associations
    const taskWithAssociations = await Task.findByPk(task.id, {
      include: [
        { model: Tag, attributes: ['name'], through: { attributes: [] } },
        { model: Project, attributes: ['name'], required: false }
      ]
    });

    res.json({
      ...taskWithAssociations.toJSON(),
      due_date: taskWithAssociations.due_date ? taskWithAssociations.due_date.toISOString().split('T')[0] : null
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(400).json({ 
      error: 'There was a problem updating the task.', 
      details: error.errors ? error.errors.map(e => e.message) : [error.message]
    });
  }
});

// PATCH /api/task/:id/toggle_completion
router.patch('/task/:id/toggle_completion', async (req, res) => {
  try {
    const task = await Task.findOne({
      where: { id: req.params.id, user_id: req.currentUser.id }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const newStatus = task.status === Task.STATUS.DONE
      ? (task.note ? Task.STATUS.IN_PROGRESS : Task.STATUS.NOT_STARTED)
      : Task.STATUS.DONE;

    await task.update({ status: newStatus });

    res.json({
      ...task.toJSON(),
      due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
    });
  } catch (error) {
    console.error('Error toggling task completion:', error);
    res.status(422).json({ error: 'Unable to update task' });
  }
});

// DELETE /api/task/:id
router.delete('/task/:id', async (req, res) => {
  try {
    const task = await Task.findOne({
      where: { id: req.params.id, user_id: req.currentUser.id }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await task.destroy();
    res.json({ message: 'Task successfully deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(400).json({ error: 'There was a problem deleting the task.' });
  }
});

module.exports = router;