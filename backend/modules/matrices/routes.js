'use strict';

const express = require('express');
const router = express.Router();
const matricesController = require('./controller');

// All routes require authentication (handled by app.js middleware)

// List all matrices
router.get('/matrices', matricesController.list);

// Get all task placements for the user (bulk, for dot indicators)
router.get('/matrices/placements', matricesController.allPlacements);

// Browse available tasks for a matrix (filtered by source category)
router.get('/matrices/:matrixId/browse', matricesController.browseTasks);

// Get a single matrix with tasks
router.get('/matrices/:matrixId', matricesController.getOne);

// Create a new matrix
router.post('/matrices', matricesController.create);

// Update a matrix
router.put('/matrices/:matrixId', matricesController.update);

// Delete a matrix
router.delete('/matrices/:matrixId', matricesController.delete);

// Assign or move a task in a matrix
router.put('/matrices/:matrixId/tasks/:taskId', matricesController.assignTask);

// Remove a task from a matrix
router.delete(
    '/matrices/:matrixId/tasks/:taskId',
    matricesController.removeTask
);

// Get all matrix placements for a task
router.get('/tasks/:taskId/matrices', matricesController.getTaskMatrices);

module.exports = router;
