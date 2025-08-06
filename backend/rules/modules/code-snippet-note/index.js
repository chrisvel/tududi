const config = require('./config.json');
const conditions = require('./conditions');
const { createRuleModule } = require('../../base-evaluator');

module.exports = createRuleModule(config, conditions);
