'use strict';

const express = require('express');
const router = express.Router();
const peopleController = require('./controller');
const { hasAccess } = require('../../middleware/authorize');
const projectsService = require('../projects/service');

// People assignable to tasks in a project: the caller's own people plus the
// self-person of the project owner and any collaborators it's shared with.
// Requires at least read access to the project.
router.get(
    '/projects/:uidSlug/assignable-people',
    hasAccess(
        'ro',
        'project',
        (req) => projectsService.getProjectUidIfExists(req.params.uidSlug),
        { notFoundMessage: 'Project not found' }
    ),
    peopleController.listAssignable
);

// People assignable to a task that is not in a project: the caller's own
// people plus everyone they share with or are in a group with.
router.get('/people/assignable', peopleController.listWorkspaceAssignable);

router.get('/people', peopleController.list);
router.get('/people/:uid', peopleController.getOne);
router.post('/people', peopleController.create);
router.patch('/people/:uid', peopleController.update);
router.delete('/people/:uid', peopleController.delete);

module.exports = router;
