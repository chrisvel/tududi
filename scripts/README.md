# Translation Synchronization Script

This script helps maintain consistent translations across all language files by comparing them with the English base translation and using OpenAI to fill in missing translations.

## Setup

### Prerequisites

1. **Node.js** (version 14 or higher)
2. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/api-keys)

### Installation

```bash
cd scripts
npm install
```

### Environment Setup

Set your OpenAI API key as an environment variable:

```bash
# Linux/macOS
export OPENAI_API_KEY="your-openai-api-key-here"

# Windows
set OPENAI_API_KEY=your-openai-api-key-here
```

## Usage

### Check All Languages

```bash
./sync-translations.js --all
```

### Check Specific Languages

```bash
./sync-translations.js --lang=jp,el,de
./sync-translations.js --lang=es
```

### Dry Run (Preview Changes)

```bash
./sync-translations.js --all --dry-run
./sync-translations.js --lang=it --dry-run
```

### Detailed Analysis

```bash
# Show detailed missing translations with English values
./sync-translations.js --lang=el --dry-run --verbose

# Export missing translations to JSON file
./sync-translations.js --all --dry-run --output missing-translations.json
```

## How It Works

1. **Base Comparison**: Uses English (`en`) as the base language
2. **Multi-File Support**: Processes both `translation.json` and `quotes.json` files
3. **Key Analysis**: Recursively compares all keys and nested objects
4. **Missing Detection**: Identifies missing translations in target languages
5. **Batch Processing**: Groups missing translations into batches of 20
6. **AI Translation**: Uses OpenAI GPT-4 to translate missing content
7. **File Updates**: Updates translation files with new translations

## Features

- ✅ **Multi-File Support**: Handles both `translation.json` and `quotes.json` files
- ✅ **Recursive Analysis**: Handles nested translation objects
- ✅ **Batch Processing**: Efficient API usage with configurable batch sizes
- ✅ **Placeholder Preservation**: Maintains `{{variables}}` and formatting
- ✅ **Context Awareness**: Provides context for better translations
- ✅ **Error Handling**: Graceful error handling and reporting
- ✅ **Dry Run Mode**: Preview changes before applying (no API key required)
- ✅ **Progress Tracking**: Clear progress indicators
- ✅ **File Backup**: Maintains original file structure

## Supported Languages

- `ar` - Arabic (العربية) 🇸🇦
- `bg` - Bulgarian (Български) 🇧🇬
- `da` - Danish (Dansk) 🇩🇰
- `de` - German (Deutsch) 🇩🇪
- `el` - Greek (Ελληνικά) 🇬🇷
- `es` - Spanish (Español) 🇪🇸
- `fi` - Finnish (Suomi) 🇫🇮
- `fr` - French (Français) 🇫🇷
- `id` - Indonesian (Bahasa Indonesia) 🇮🇩
- `it` - Italian (Italiano) 🇮🇹
- `jp` - Japanese (日本語) 🇯🇵
- `ko` - Korean (한국어) 🇰🇷
- `nl` - Dutch (Nederlands) 🇳🇱
- `no` - Norwegian (Norsk) 🇳🇴
- `pl` - Polish (Polski) 🇵🇱
- `pt` - Portuguese (Português) 🇵🇹
- `ro` - Romanian (Română) 🇷🇴
- `ru` - Russian (Русский) 🇷🇺
- `sl` - Slovenian (Slovenščina) 🇸🇮
- `sv` - Swedish (Svenska) 🇸🇪
- `tr` - Turkish (Türkçe) 🇹🇷
- `ua` - Ukrainian (Українська) 🇺🇦
- `vi` - Vietnamese (Tiếng Việt) 🇻🇳
- `zh` - Chinese (中文) 🇨🇳

## Examples

### Using NPM Scripts (Recommended)

```bash
# Quick dry run of all languages
npm run translations:dry-run

# Detailed analysis with all missing translations
npm run translations:check

# Export missing translations to JSON file
npm run translations:export

# Update all languages (requires OPENAI_API_KEY)
npm run translations:sync-all
```

### Full Synchronization
```bash
# Update all languages with missing translations
./sync-translations.js --all
```

### Targeted Updates
```bash
# Update only Japanese and Italian
./sync-translations.js --lang=jp,it

# Preview changes for German
./sync-translations.js --lang=de --dry-run

# Detailed analysis of missing Spanish translations
./sync-translations.js --lang=es --dry-run --verbose

# Export all missing translations to review
./sync-translations.js --all --dry-run --output review.json
```

### Sample Output
```
🌍 Translation Synchronization Tool

📁 Locales directory: /path/to/public/locales
🏴󠁧󠁢󠁥󠁮󠁧󠁿 Base language: en
🔄 Processing all available languages: es, de, el, jp, ua, it

📊 Analyzing es (Spanish)...
✅ es: All translations are up to date!

📊 Analyzing de (German)...
📝 Found 5 missing translation(s) for de
📦 Processing 1 batch(es) of translations...
   Batch 1/1 (5 items)...
✅ de: Applied 5/5 translations

🎉 Completed! Successfully updated 2/6 languages
```

## Configuration

### Batch Size
Modify `BATCH_SIZE` in the script to change how many translations are sent per API request (default: 50).

### API Model
The script uses GPT-4 by default. You can change this in the `requestTranslations` function.

### Rate Limiting
The script includes a 1-second delay between API requests to respect rate limits.

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   ```
   ❌ Error: OPENAI_API_KEY environment variable is required
   ```
   Solution: Set the environment variable with your OpenAI API key.

2. **Invalid Language Code**
   ```
   ❌ Invalid language codes: xx
   ```
   Solution: Use valid language codes from the supported list.

3. **API Rate Limits**
   If you hit rate limits, the script will show an error. Wait a moment and try again.

### File Structure

The script expects the following directory structure:
```
public/
├── locales/
│   ├── en/
│   │   ├── translation.json
│   │   └── quotes.json
│   ├── es/
│   │   ├── translation.json
│   │   └── quotes.json
│   ├── de/
│   │   ├── translation.json
│   │   └── quotes.json
│   └── ...
```

## Contributing

To add support for new languages:

1. Add the language code and name to `LANGUAGE_NAMES` object
2. Create the language directory in `public/locales/`
3. Run the script to generate initial translations

## Security

- API keys are passed securely through environment variables
- No sensitive data is logged or stored
- Translation requests use HTTPS