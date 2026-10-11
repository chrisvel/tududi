// Life-to-Day (T-302): ban NEW physical direction classes in
// frontend/components. The RTL codemod rewrote everything to logical
// utilities (ms/me/ps/pe, start/end); this rule keeps it that way.
// Exceptions: left-1/2 / right-1/2 (centering) and files whose LTD-PATCH
// comment marks dir=ltr as deliberate.

const CENTERING = new Set(['left-1/2', 'right-1/2']);
const PHYSICAL = /^-?(?:ml|mr|pl|pr)-|^-?(?:left|right)-|^text-(?:left|right)$/;

const isPhysicalToken = (token) => {
    // Strip variant prefixes (md:, hover:, rtl:, ...) and leading !important.
    const utility = token.split(':').pop().replace(/^!/, '');
    if (CENTERING.has(utility)) return false;
    return PHYSICAL.test(utility);
};

const checkText = (context, node, text) => {
    for (const rawToken of text.split(/\s+/)) {
        if (rawToken && isPhysicalToken(rawToken)) {
            context.report({
                node,
                message:
                    "Physical direction class '{{token}}' is not allowed; use the logical Tailwind utility (ms/me/ps/pe, start/end, text-start/text-end).",
                data: { token: rawToken },
            });
        }
    }
};

export default {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'disallow physical direction Tailwind classes (use logical utilities)',
        },
        schema: [],
        messages: {},
    },
    create(context) {
        const sourceText = context.sourceCode.getText();
        // Files that deliberately pin dir=ltr (documented via LTD-PATCH) are
        // exempt — their physical geometry is intentional.
        if (/LTD-PATCH\(T-\d+\)[^\n]*dir=ltr/.test(sourceText)) {
            return {};
        }

        const isClassAttr = (node) =>
            node.type === 'JSXAttribute' &&
            (node.name.name === 'className' || node.name.name === 'class');

        return {
            JSXAttribute(node) {
                if (!isClassAttr(node) || !node.value) return;
                if (
                    node.value.type === 'Literal' &&
                    typeof node.value.value === 'string'
                ) {
                    checkText(context, node.value, node.value.value);
                }
            },
            // className={`...`} template literals (static parts only)
            TemplateElement(node) {
                let parent = node.parent;
                while (parent && parent.type === 'TemplateLiteral') {
                    parent = parent.parent;
                }
                if (
                    parent &&
                    parent.type === 'JSXExpressionContainer' &&
                    parent.parent &&
                    isClassAttr(parent.parent)
                ) {
                    checkText(context, node, node.value.cooked || '');
                }
            },
        };
    },
};
