'use strict';
const { steps, labelTools } = require('./index');
// T-804: explicit dependency injection only; never selectable over HTTP.
class FakeProvider {
    constructor(responses) {
        this.responses = [...responses];
        this.messages = [];
    }
    async generateStructured(_schema, messages) {
        this.messages.push(structuredClone(messages));
        const value = this.responses.shift();
        if (value instanceof Error) throw value;
        return { value, usage: { inputTokens: 20, outputTokens: 10 } };
    }
    async runTools(tools, messages, maxSteps = 4) {
        const limit = steps(maxSteps);
        const results = [];
        tools = labelTools(tools);
        for (let i = 0; i < limit && this.responses.length; i++) {
            const call = this.responses.shift();
            if (!tools[call.name]) throw new Error('Unknown tool');
            results.push(await tools[call.name].execute(call.args));
        }
        this.messages.push(structuredClone(messages));
        return results;
    }
}
module.exports = { FakeProvider };
