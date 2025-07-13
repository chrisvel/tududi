#!/bin/bash

echo "🌍 Translation Sync Script Examples"
echo "=================================="
echo ""

echo "📋 Prerequisites:"
echo "1. Set your OpenAI API key: export OPENAI_API_KEY=\"your-key-here\""
echo "2. Install dependencies: cd scripts && npm install"
echo ""

echo "📖 Basic Usage Examples:"
echo ""

echo "# Check what would be updated (dry run):"
echo "npm run translations:dry-run"
echo ""

echo "# Update all languages:"
echo "npm run translations:sync-all"
echo ""

echo "# Update specific languages:"
echo "npm run translations:sync -- --lang=jp,de"
echo ""

echo "# Check specific language:"
echo "npm run translations:sync -- --lang=es --dry-run"
echo ""

echo "🔧 Direct Script Usage:"
echo ""

echo "# From scripts directory:"
echo "cd scripts"
echo "./sync-translations.js --all"
echo "./sync-translations.js --lang=jp,el,de"
echo "./sync-translations.js --lang=it --dry-run"
echo ""

echo "📊 Current Status:"
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set"
else
    echo "✅ OPENAI_API_KEY is configured"
fi

echo ""
echo "🗂️  Available Languages:"
echo "- de (German)"
echo "- es (Spanish)" 
echo "- el (Greek)"
echo "- it (Italian)"
echo "- jp (Japanese)"
echo "- ua (Ukrainian)"