'use strict';

const { registerTaskTools } = require('./tools/taskTools');
const { registerProjectTools } = require('./tools/projectTools');
const { registerInboxTools } = require('./tools/inboxTools');
const { registerMiscTools } = require('./tools/miscTools');
const { registerHabitTools } = require('./tools/habitTools');
const { registerAreaTools } = require('./tools/areaTools');
const { registerTagTools } = require('./tools/tagTools');
const { registerNoteTools } = require('./tools/noteTools');
const { registerViewTools } = require('./tools/viewTools');
const { registerPeopleTools } = require('./tools/peopleTools');
const { registerGoalTools } = require('./tools/goalTools');

function registerAllTools(server, context, tools) {
    registerTaskTools(server, context, tools);
    registerProjectTools(server, context, tools);
    registerInboxTools(server, context, tools);
    registerMiscTools(server, context, tools);
    registerHabitTools(server, context, tools);
    registerAreaTools(server, context, tools);
    registerTagTools(server, context, tools);
    registerNoteTools(server, context, tools);
    registerViewTools(server, context, tools);
    registerPeopleTools(server, context, tools);
    registerGoalTools(server, context, tools);
}

module.exports = { registerAllTools };
