const express = require('express');
const { Task, Tag, Project, sequelize } = require('../models');
const { Op } = require('sequelize');
const RecurringTaskService = require('../services/recurringTaskService');
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
      whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, Task.STATUS.ARCHIVED, 'done', 'archived'] }; // Exclude completed and archived tasks (both integer and string values)
      break;
    case 'upcoming':
      whereClause.due_date = {
        [Op.between]: [new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      };
      whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
      break;
    case 'next':
      whereClause.due_date = null;
      whereClause.project_id = null;
      whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
      break;
    case 'inbox':
      whereClause[Op.or] = [
        { due_date: null },
        { project_id: null }
      ];
      whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
      break;
    case 'someday':
      whereClause.due_date = null;
      whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
      break;
    case 'waiting':
      whereClause.status = Task.STATUS.WAITING;
      break;
    default:
      if (params.status === 'done') {
        whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
      } else {
        whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
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
      { 
        model: Tag, 
        attributes: ['id', 'name'], 
        through: { attributes: [] },
        required: false 
      },
      { 
        model: Project, 
        attributes: ['id', 'name', 'active'], 
        required: false 
      }
    ],
    order: [['priority', 'DESC']]
  });

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const tasksDueToday = await Task.findAll({
    where: {
      user_id: userId,
      status: { [Op.notIn]: [Task.STATUS.DONE, Task.STATUS.ARCHIVED, 'done', 'archived'] },
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
      { 
        model: Tag, 
        attributes: ['id', 'name'], 
        through: { attributes: [] },
        required: false 
      },
      { 
        model: Project, 
        attributes: ['id', 'name', 'active'], 
        required: false 
      }
    ]
  });

  // Get suggested tasks only if user has a meaningful task base
  let suggestedTasks = [];
  
  // Only show suggested tasks if:
  // 1. User has at least 3 total tasks, OR
  // 2. User has at least 1 project with tasks
  if (totalOpenTasks >= 3 || (tasksInProgress.length > 0 || tasksDueToday.length > 0)) {
    const excludedTaskIds = [
      ...tasksInProgress.map(t => t.id),
      ...tasksDueToday.map(t => t.id)
    ];

    suggestedTasks = await Task.findAll({
      where: {
        user_id: userId,
        status: Task.STATUS.NOT_STARTED,
        id: { [Op.notIn]: excludedTaskIds }
      },
      include: [
        { 
          model: Tag, 
          attributes: ['id', 'name'], 
          through: { attributes: [] },
          required: false 
        },
        { 
          model: Project, 
          attributes: ['id', 'name', 'active'], 
          required: false 
        }
      ],
      order: [['priority', 'DESC']],
      limit: 10
    });
  }

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

// GET /api/task/:id
router.get('/task/:id', async (req, res) => {
  try {
    const task = await Task.findOne({
      where: { id: req.params.id, user_id: req.currentUser.id },
      include: [
        { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Project, attributes: ['name'], required: false }
      ]
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.json({
      ...task.toJSON(),
      due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/task
router.post('/task', async (req, res) => {
  try {
    const { 
      name, 
      priority, 
      due_date, 
      status, 
      note, 
      project_id, 
      tags,
      recurrence_type,
      recurrence_interval,
      recurrence_end_date,
      recurrence_weekday,
      recurrence_month_day,
      recurrence_week_of_month,
      completion_based
    } = req.body;

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
      user_id: req.currentUser.id,
      recurrence_type: recurrence_type || 'none',
      recurrence_interval: recurrence_interval || null,
      recurrence_end_date: recurrence_end_date || null,
      recurrence_weekday: recurrence_weekday !== undefined ? recurrence_weekday : null,
      recurrence_month_day: recurrence_month_day !== undefined ? recurrence_month_day : null,
      recurrence_week_of_month: recurrence_week_of_month !== undefined ? recurrence_week_of_month : null,
      completion_based: completion_based || false
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
    const { 
      name, 
      priority, 
      status, 
      note, 
      due_date, 
      project_id, 
      tags,
      recurrence_type,
      recurrence_interval,
      recurrence_end_date,
      recurrence_weekday,
      recurrence_month_day,
      recurrence_week_of_month,
      completion_based,
      update_parent_recurrence
    } = req.body;

    const task = await Task.findOne({
      where: { id: req.params.id, user_id: req.currentUser.id }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Handle updating parent recurrence settings if this is a child task
    if (update_parent_recurrence && task.recurring_parent_id) {
      const parentTask = await Task.findOne({
        where: { id: task.recurring_parent_id, user_id: req.currentUser.id }
      });
      
      if (parentTask) {
        await parentTask.update({
          recurrence_type: recurrence_type !== undefined ? recurrence_type : parentTask.recurrence_type,
          recurrence_interval: recurrence_interval !== undefined ? recurrence_interval : parentTask.recurrence_interval,
          recurrence_end_date: recurrence_end_date !== undefined ? recurrence_end_date : parentTask.recurrence_end_date,
          recurrence_weekday: recurrence_weekday !== undefined ? recurrence_weekday : parentTask.recurrence_weekday,
          recurrence_month_day: recurrence_month_day !== undefined ? recurrence_month_day : parentTask.recurrence_month_day,
          recurrence_week_of_month: recurrence_week_of_month !== undefined ? recurrence_week_of_month : parentTask.recurrence_week_of_month,
          completion_based: completion_based !== undefined ? completion_based : parentTask.completion_based
        });
        console.log(`Updated parent task ${parentTask.id} recurrence settings from child task ${task.id}`);
      }
    }

    const taskAttributes = {
      name,
      priority,
      status: status || Task.STATUS.NOT_STARTED,
      note,
      due_date: due_date || null,
      recurrence_type: recurrence_type !== undefined ? recurrence_type : task.recurrence_type,
      recurrence_interval: recurrence_interval !== undefined ? recurrence_interval : task.recurrence_interval,
      recurrence_end_date: recurrence_end_date !== undefined ? recurrence_end_date : task.recurrence_end_date,
      recurrence_weekday: recurrence_weekday !== undefined ? recurrence_weekday : task.recurrence_weekday,
      recurrence_month_day: recurrence_month_day !== undefined ? recurrence_month_day : task.recurrence_month_day,
      recurrence_week_of_month: recurrence_week_of_month !== undefined ? recurrence_week_of_month : task.recurrence_week_of_month,
      completion_based: completion_based !== undefined ? completion_based : task.completion_based
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

    console.log('🎯 Toggle completion called for task:', {
      id: task.id,
      name: task.name,
      currentStatus: task.status,
      recurrence_type: task.recurrence_type,
      completion_based: task.completion_based
    });

    const newStatus = (task.status === Task.STATUS.DONE || task.status === 'done')
      ? (task.note ? Task.STATUS.IN_PROGRESS : Task.STATUS.NOT_STARTED)
      : Task.STATUS.DONE;

    console.log('📝 Status changing from', task.status, 'to', newStatus);

    await task.update({ status: newStatus });

    // Handle recurring task completion
    let nextTask = null;
    if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
      console.log('✅ Task marked as done, calling RecurringTaskService...');
      nextTask = await RecurringTaskService.handleTaskCompletion(task);
    } else {
      console.log('❌ Task not marked as done, skipping RecurringTaskService');
    }

    const response = {
      ...task.toJSON(),
      due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
    };

    if (nextTask) {
      response.next_task = {
        ...nextTask.toJSON(),
        due_date: nextTask.due_date ? nextTask.due_date.toISOString().split('T')[0] : null
      };
    }

    res.json(response);
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

// POST /api/tasks/generate-recurring
router.post('/tasks/generate-recurring', async (req, res) => {
  try {
    const newTasks = await RecurringTaskService.generateRecurringTasks(req.currentUser.id);
    
    res.json({
      message: `Generated ${newTasks.length} recurring tasks`,
      tasks: newTasks.map(task => ({
        ...task.toJSON(),
        due_date: task.due_date ? task.due_date.toISOString().split('T')[0] : null
      }))
    });
  } catch (error) {
    console.error('Error generating recurring tasks:', error);
    res.status(500).json({ error: 'Failed to generate recurring tasks' });
  }
});

module.exports = router;