const fs = require('fs');
const path = require('path');

function loadModularRules() {
    const rulesDir = path.join(__dirname, 'modules');

    if (!fs.existsSync(rulesDir)) {
        console.warn('Modular rules directory does not exist:', rulesDir);
        return { rules: [], condition_types: {} };
    }

    const ruleFolders = fs.readdirSync(rulesDir).filter((item) => {
        const itemPath = path.join(rulesDir, item);
        return fs.statSync(itemPath).isDirectory();
    });

    const rules = [];
    const condition_types = {};

    for (const folder of ruleFolders) {
        try {
            const modulePath = path.join(rulesDir, folder);
            const ruleModule = require(modulePath);

            if (!ruleModule.id || !ruleModule.name || !ruleModule.conditions) {
                console.warn(
                    `Invalid rule module structure in ${folder}:`,
                    'Missing required properties (id, name, conditions)'
                );
                continue;
            }

            rules.push(ruleModule);

            if (
                ruleModule.conditions &&
                typeof ruleModule.conditions === 'object'
            ) {
                Object.keys(ruleModule.conditions).forEach((conditionType) => {
                    if (
                        typeof ruleModule.conditions[conditionType] ===
                        'function'
                    ) {
                        condition_types[conditionType] = {
                            description: `Condition handler from ${ruleModule.name}`,
                            module: ruleModule.id,
                        };
                    }
                });
            }

            console.log(
                `Loaded modular rule: ${ruleModule.name} (${ruleModule.id})`
            );
        } catch (error) {
            console.error(
                `Error loading rule module ${folder}:`,
                error.message
            );
        }
    }

    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    console.log(`Loaded ${rules.length} modular suggestion rules`);

    return {
        rules,
        condition_types,
    };
}

function getRuleById(ruleId) {
    const config = loadModularRules();
    return config.rules.find((rule) => rule.id === ruleId) || null;
}

function listRules() {
    const config = loadModularRules();
    return config.rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
    }));
}

module.exports = {
    loadModularRules,
    getRuleById,
    listRules,
};
