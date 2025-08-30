const evaluateCondition = (condition, context, conditions, ruleId) => {
    const { type, value, operator } = condition;
    const conditionFn = conditions[type];

    if (!conditionFn) {
        console.warn(`Unknown condition type for ${ruleId}: ${type}`);
        return false;
    }

    return conditionFn(value, context, operator);
};

const evaluateOrConditions = (orConditions, context, conditions, ruleId) => {
    return orConditions.some((condition) =>
        evaluateCondition(condition, context, conditions, ruleId)
    );
};

const evaluateAndConditions = (andConditions, context, conditions, ruleId) => {
    return andConditions.every((condition) =>
        evaluateCondition(condition, context, conditions, ruleId)
    );
};

const evaluateRule = (config, context, conditions) => {
    const ruleId = config.id;

    if (config.conditions.or) {
        return evaluateOrConditions(
            config.conditions.or,
            context,
            conditions,
            ruleId
        );
    }

    if (config.conditions.and) {
        return evaluateAndConditions(
            config.conditions.and,
            context,
            conditions,
            ruleId
        );
    }

    return evaluateCondition(config.conditions, context, conditions, ruleId);
};

const createRuleModule = (config, conditions, processAction = null) => {
    const evaluate = (context) => {
        return evaluateRule(config, context, conditions);
    };

    const module = {
        ...config,
        conditions,
        evaluate,
        evaluateCondition: (condition, context) =>
            evaluateCondition(condition, context, conditions, config.id),
        evaluateOrConditions: (orConditions, context) =>
            evaluateOrConditions(orConditions, context, conditions, config.id),
        evaluateAndConditions: (andConditions, context) =>
            evaluateAndConditions(
                andConditions,
                context,
                conditions,
                config.id
            ),
    };

    if (processAction && typeof processAction === 'function') {
        module.processAction = (context) =>
            processAction(context, config.action);
    }

    return module;
};

module.exports = {
    evaluateCondition,
    evaluateOrConditions,
    evaluateAndConditions,
    evaluateRule,
    createRuleModule,
};
