const express = require('express');
const { Project, Task, Tag, Area, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Helper function to update project tags
async function updateProjectTags(project, tagsData, userId) {
  if (!tagsData) return;

  const tagNames = tagsData
    .map(tag => tag.name)
    .filter(name => name && name.trim())
    .filter((name, index, arr) => arr.indexOf(name) === index); // unique

  if (tagNames.length === 0) {
    await project.setTags([]);
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

  // Set all tags to project
  const allTags = [...existingTags, ...createdTags];
  await project.setTags(allTags);
}

// GET /api/projects
router.get('/projects', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { active, pin_to_sidebar, area_id } = req.query;
    
    let whereClause = { user_id: req.session.userId };
    
    // Filter by active status
    if (active === 'true') {
      whereClause.active = true;
    } else if (active === 'false') {
      whereClause.active = false;
    }
    
    // Filter by pinned status
    if (pin_to_sidebar === 'true') {
      whereClause.pin_to_sidebar = true;
    } else if (pin_to_sidebar === 'false') {
      whereClause.pin_to_sidebar = false;
    }
    
    // Filter by area
    if (area_id && area_id !== '') {
      whereClause.area_id = area_id;
    }

    const projects = await Project.findAll({
      where: whereClause,
      include: [
        { 
          model: Task, 
          required: false,
          attributes: ['id', 'status']
        },
        { 
          model: Area, 
          required: false,
          attributes: ['name'] 
        },
        { 
          model: Tag, 
          attributes: ['id', 'name'], 
          through: { attributes: [] } 
        }
      ],
      order: [['name', 'ASC']]
    });

    const { grouped } = req.query;
    
    // Calculate task status counts for each project
    const taskStatusCounts = {};
    const enhancedProjects = projects.map(project => {
      const tasks = project.Tasks || [];
      const taskStatus = {
        total: tasks.length,
        done: tasks.filter(t => t.status === 2).length,
        in_progress: tasks.filter(t => t.status === 1).length,
        not_started: tasks.filter(t => t.status === 0).length
      };
      
      taskStatusCounts[project.id] = taskStatus;
      
      return {
        ...project.toJSON(),
        due_date_at: project.due_date_at ? project.due_date_at.toISOString() : null,
        task_status: taskStatus,
        completion_percentage: taskStatus.total > 0 ? Math.round((taskStatus.done / taskStatus.total) * 100) : 0
      };
    });

    // If grouped=true, return grouped format
    if (grouped === 'true') {
      console.log('Returning grouped format');
      const groupedProjects = {};
      enhancedProjects.forEach(project => {
        const areaName = project.Area ? project.Area.name : 'No Area';
        if (!groupedProjects[areaName]) {
          groupedProjects[areaName] = [];
        }
        groupedProjects[areaName].push(project);
      });
      console.log('Grouped projects structure:', Object.keys(groupedProjects).map(key => `${key}: ${groupedProjects[key].length} projects`));
      res.json(groupedProjects);
    } else {
      console.log('Returning flat array format');
      res.json({
        projects: enhancedProjects
      });
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/project/:id
router.get('/project/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const project = await Project.findOne({
      where: { id: req.params.id, user_id: req.session.userId },
      include: [
        { model: Task, required: false },
        { model: Area, required: false, attributes: ['id', 'name'] },
        { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } }
      ]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      ...project.toJSON(),
      due_date_at: project.due_date_at ? project.due_date_at.toISOString() : null
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/project
router.post('/project', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, description, area_id, priority, due_date_at, tags } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectData = {
      name: name.trim(),
      description: description || '',
      area_id: area_id || null,
      active: true,
      pin_to_sidebar: false,
      priority: priority || null,
      due_date_at: due_date_at || null,
      user_id: req.session.userId
    };

    const project = await Project.create(projectData);
    await updateProjectTags(project, tags, req.session.userId);

    // Reload project with associations
    const projectWithAssociations = await Project.findByPk(project.id, {
      include: [
        { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } }
      ]
    });

    res.status(201).json({
      ...projectWithAssociations.toJSON(),
      due_date_at: projectWithAssociations.due_date_at ? projectWithAssociations.due_date_at.toISOString() : null
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(400).json({ 
      error: 'There was a problem creating the project.', 
      details: error.errors ? error.errors.map(e => e.message) : [error.message]
    });
  }
});

// PATCH /api/project/:id
router.patch('/project/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const project = await Project.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const { name, description, area_id, active, pin_to_sidebar, priority, due_date_at, tags } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (area_id !== undefined) updateData.area_id = area_id;
    if (active !== undefined) updateData.active = active;
    if (pin_to_sidebar !== undefined) updateData.pin_to_sidebar = pin_to_sidebar;
    if (priority !== undefined) updateData.priority = priority;
    if (due_date_at !== undefined) updateData.due_date_at = due_date_at;

    await project.update(updateData);
    await updateProjectTags(project, tags, req.session.userId);

    // Reload project with associations
    const projectWithAssociations = await Project.findByPk(project.id, {
      include: [
        { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } }
      ]
    });

    res.json({
      ...projectWithAssociations.toJSON(),
      due_date_at: projectWithAssociations.due_date_at ? projectWithAssociations.due_date_at.toISOString() : null
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(400).json({ 
      error: 'There was a problem updating the project.', 
      details: error.errors ? error.errors.map(e => e.message) : [error.message]
    });
  }
});

// DELETE /api/project/:id
router.delete('/project/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const project = await Project.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await project.destroy();
    res.json({ message: 'Project successfully deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(400).json({ error: 'There was a problem deleting the project.' });
  }
});

module.exports = router;