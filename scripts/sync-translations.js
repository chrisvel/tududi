#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// Configuration
const LOCALES_DIR = path.join(__dirname, '../public/locales');
const BASE_LANGUAGE = 'en';
const BATCH_SIZE = 20;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
// Base translation files to check
const BASE_TRANSLATION_FILES = ['translation.json', 'quotes.json'];

// Language mappings for OpenAI
const LANGUAGE_NAMES = {
    es: 'Spanish',
    de: 'German',
    el: 'Greek',
    jp: 'Japanese',
    ua: 'Ukrainian',
    it: 'Italian',
    fr: 'French',
    ru: 'Russian',
    tr: 'Turkish',
    ko: 'Korean',
    vi: 'Vietnamese',
    ar: 'Arabic',
    nl: 'Dutch',
    ro: 'Romanian',
    zh: 'Mandarin Chinese',
    pt: 'Portuguese',
    id: 'Indonesian',
    no: 'Norwegian',
    fi: 'Finnish',
    da: 'Danish',
    sv: 'Swedish',
    pl: 'Polish',
    bg: 'Bulgarian',
    sl: 'Slovenian',
};

// Get OpenAI API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Load and parse a JSON translation file
 */
function loadTranslationFile(language, filename = 'translation.json') {
    const filePath = path.join(LOCALES_DIR, language, filename);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(
            `⚠️  Warning: Could not load ${filePath}: ${error.message}`
        );
        return {};
    }
}

/**
 * Save translation file with proper formatting
 */
function saveTranslationFile(language, data, filename = 'translation.json') {
    const filePath = path.join(LOCALES_DIR, language, filename);
    const dirPath = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString + '\n', 'utf8');
}

/**
 * Get all available language codes
 */
function getAvailableLanguages() {
    try {
        return fs.readdirSync(LOCALES_DIR).filter((dir) => {
            const stat = fs.statSync(path.join(LOCALES_DIR, dir));
            return stat.isDirectory() && dir !== BASE_LANGUAGE;
        });
    } catch (error) {
        console.error(`❌ Error reading locales directory: ${error.message}`);
        return [];
    }
}

/**
 * Get available translation files for the base language
 */
function getAvailableTranslationFiles() {
    const availableFiles = [];
    
    for (const filename of BASE_TRANSLATION_FILES) {
        const filePath = path.join(LOCALES_DIR, BASE_LANGUAGE, filename);
        if (fs.existsSync(filePath)) {
            availableFiles.push(filename);
        }
    }
    
    return availableFiles;
}

/**
 * Recursively compare objects and find missing keys
 */
function findMissingKeys(baseObj, targetObj, currentPath = '') {
    const missing = [];

    for (const [key, value] of Object.entries(baseObj)) {
        const fullPath = currentPath ? `${currentPath}.${key}` : key;

        if (!(key in targetObj)) {
            // If the missing key is an object, recursively add all its nested keys
            if (typeof value === 'object' && value !== null) {
                missing.push(...findMissingKeys(value, {}, fullPath));
            } else {
                missing.push({
                    path: fullPath,
                    value: value,
                    isNested: false,
                });
            }
        } else if (
            typeof value === 'object' &&
            value !== null &&
            typeof targetObj[key] === 'object' &&
            targetObj[key] !== null
        ) {
            // Recursively check nested objects
            missing.push(...findMissingKeys(value, targetObj[key], fullPath));
        }
    }

    return missing;
}

/**
 * Set nested object property using dot notation
 */
function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}

/**
 * Create translation batches for OpenAI API
 */
function createTranslationBatches(missingKeys, batchSize = BATCH_SIZE) {
    const batches = [];

    for (let i = 0; i < missingKeys.length; i += batchSize) {
        const batch = missingKeys.slice(i, i + batchSize);
        batches.push(batch);
    }

    return batches;
}

/**
 * Request translations from OpenAI API
 */
async function requestTranslations(batch, targetLanguage) {
    const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    // Prepare the translation request
    const translationItems = batch.map((item) => ({
        key: item.path,
        english:
            typeof item.value === 'string'
                ? item.value
                : JSON.stringify(item.value),
    }));

    const prompt = `You are a professional translator. Translate the following English text to ${languageName}. 

IMPORTANT INSTRUCTIONS:
1. Maintain the exact same structure and formatting
2. Preserve all placeholders like {{variable}}, {{count}}, etc.
3. Keep HTML tags intact if present
4. For technical terms, use appropriate ${languageName} equivalents
5. Maintain the tone and context appropriate for a task management application
6. If the English value is an array, return an array in the translation (NOT an object with numbered keys)
7. If the English value is an object, return an object in the translation
8. Return ONLY a JSON object with the translations

Translate these English texts:
${JSON.stringify(translationItems, null, 2)}

Return format:
{
  "translations": [
    {
      "key": "path.to.key",
      "translation": "translated text in ${languageName}"
    }
  ]
}`;

    // Debug: Log request details for troubleshooting
    console.log(`   🔍 Debug: Translating ${batch.length} items to ${languageName}`);
    console.log(`   📊 Prompt length: ${prompt.length} characters`);
    
    // Check payload size
    const requestPayload = {
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `You are a professional translator specializing in software localization. Always return valid JSON in the exact format requested.`,
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
        temperature: 0.3,
        max_tokens: 2000,
    };
    const payloadSize = JSON.stringify(requestPayload).length;
    console.log(`   📦 Request payload size: ${payloadSize} bytes`);

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
            let errorDetails = '';
            try {
                const errorBody = await response.json();
                errorDetails = ` - ${JSON.stringify(errorBody)}`;
            } catch (e) {
                // If response body isn't JSON, try to get text
                try {
                    errorDetails = ` - ${await response.text()}`;
                } catch (e2) {
                    errorDetails = ' - Unable to read error response';
                }
            }
            throw new Error(
                `OpenAI API error: ${response.status} ${response.statusText}${errorDetails}`
            );
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Parse the JSON response
        const translationResponse = JSON.parse(content);
        return translationResponse.translations || [];
    } catch (error) {
        console.error(`❌ Error requesting translations: ${error.message}`);
        return [];
    }
}

/**
 * Process a single language
 */
async function processLanguage(language) {
    console.log(
        `\n📊 Analyzing ${language} (${LANGUAGE_NAMES[language] || language})...`
    );

    let totalMissingKeys = 0;
    let totalAppliedCount = 0;
    let processedFiles = 0;

    // Get available translation files from base language
    const availableFiles = getAvailableTranslationFiles();
    
    // Process each translation file
    for (const filename of availableFiles) {
        console.log(`\n  📄 Processing ${filename}...`);

        // Load base and target translation files
        const baseTranslations = loadTranslationFile(BASE_LANGUAGE, filename);
        const targetTranslations = loadTranslationFile(language, filename);

        if (Object.keys(baseTranslations).length === 0) {
            console.warn(
                `⚠️  Warning: Could not load base ${filename} for ${BASE_LANGUAGE}, skipping...`
            );
            continue;
        }

        // Find missing keys
        const missingKeys = findMissingKeys(baseTranslations, targetTranslations);

        if (missingKeys.length === 0) {
            console.log(`  ✅ ${filename}: All translations are up to date!`);
            processedFiles++;
            continue;
        }

        console.log(
            `  📝 Found ${missingKeys.length} missing translation(s) in ${filename}`
        );
        totalMissingKeys += missingKeys.length;

        // Create batches for API requests
        const batches = createTranslationBatches(missingKeys);
        console.log(`  📦 Processing ${batches.length} batch(es) of translations...`);

        let allTranslations = [];

        // Process each batch
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(
                `     Batch ${i + 1}/${batches.length} (${batch.length} items)...`
            );

            try {
                const translations = await requestTranslations(batch, language);
                allTranslations.push(...translations);

                // Add a small delay between requests to be respectful to the API
                if (i < batches.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(
                    `  ❌ Error processing batch ${i + 1}: ${error.message}`
                );
            }
        }

        if (allTranslations.length === 0) {
            console.error(`  ❌ No translations received for ${filename}`);
            continue;
        }

        // Apply translations to the target object
        const updatedTranslations = { ...targetTranslations };
        let appliedCount = 0;

        for (const translation of allTranslations) {
            try {
                // Try to parse as JSON if it looks like an object
                let translatedValue = translation.translation;
                if (
                    translatedValue.startsWith('{') ||
                    translatedValue.startsWith('[')
                ) {
                    try {
                        translatedValue = JSON.parse(translatedValue);
                        
                        // Check if this should be an array but was translated as a numbered object
                        if (typeof translatedValue === 'object' && translatedValue !== null && !Array.isArray(translatedValue)) {
                            const keys = Object.keys(translatedValue);
                            const isNumberedObject = keys.every((key, index) => key === index.toString());
                            
                            if (isNumberedObject && keys.length > 0) {
                                // Convert numbered object back to array
                                translatedValue = keys.map(key => translatedValue[key]);
                                console.log(`  🔧 Fixed numbered object to array for ${translation.key}`);
                            }
                        }
                    } catch {
                        // Keep as string if JSON parsing fails
                    }
                }

                setNestedProperty(
                    updatedTranslations,
                    translation.key,
                    translatedValue
                );
                appliedCount++;
            } catch (error) {
                console.warn(
                    `  ⚠️  Warning: Could not apply translation for ${translation.key}: ${error.message}`
                );
            }
        }

        // Save the updated translations
        saveTranslationFile(language, updatedTranslations, filename);

        console.log(
            `  ✅ ${filename}: Applied ${appliedCount}/${missingKeys.length} translations`
        );

        totalAppliedCount += appliedCount;
        processedFiles++;
    }

    if (processedFiles === 0) {
        console.error(`❌ ${language}: No files could be processed`);
        return false;
    }

    if (totalMissingKeys === 0) {
        console.log(`✅ ${language}: All translation files are up to date!`);
        return true;
    }

    console.log(
        `✅ ${language}: Applied ${totalAppliedCount}/${totalMissingKeys} total translations across ${processedFiles} files`
    );

    return true;
}

/**
 * Main execution function
 */
async function main() {
    program
        .name('sync-translations')
        .description(
            'Synchronize translation files with English base and fill missing translations using OpenAI'
        )
        .option('--all', 'Update all available languages')
        .option(
            '--lang <languages>',
            'Comma-separated list of language codes to update (e.g., jp,el,de)'
        )
        .option(
            '--dry-run',
            'Show what would be updated without making changes'
        )
        .option(
            '--verbose',
            'Show detailed missing translations in dry run mode'
        )
        .option('--output <file>', 'Save missing translations to a JSON file')
        .parse();

    const options = program.opts();

    console.log('🌍 Translation Synchronization Tool\n');
    console.log(`📁 Locales directory: ${LOCALES_DIR}`);
    console.log(`🏴󠁧󠁢󠁥󠁮󠁧󠁿 Base language: ${BASE_LANGUAGE}`);
    
    // Show available translation files
    const availableFiles = getAvailableTranslationFiles();
    console.log(`📄 Available translation files: ${availableFiles.join(', ')}`);

    // Determine which languages to process
    let languagesToProcess = [];

    if (options.all) {
        languagesToProcess = getAvailableLanguages();
        console.log(
            `🔄 Processing all available languages: ${languagesToProcess.join(', ')}`
        );
    } else if (options.lang) {
        languagesToProcess = options.lang.split(',').map((lang) => lang.trim());
        console.log(
            `🎯 Processing specified languages: ${languagesToProcess.join(', ')}`
        );
    } else {
        console.log('❓ No languages specified. Use --all or --lang=<codes>');
        console.log(
            '\nAvailable languages:',
            getAvailableLanguages().join(', ')
        );
        process.exit(1);
    }

    if (languagesToProcess.length === 0) {
        console.log('❌ No valid languages to process');
        process.exit(1);
    }

    // Validate that all specified languages exist
    const availableLanguages = getAvailableLanguages();
    const invalidLanguages = languagesToProcess.filter(
        (lang) => !availableLanguages.includes(lang)
    );

    if (invalidLanguages.length > 0) {
        console.error(
            `❌ Invalid language codes: ${invalidLanguages.join(', ')}`
        );
        console.error(`Available languages: ${availableLanguages.join(', ')}`);
        process.exit(1);
    }

    if (options.dryRun) {
        console.log('\n🧪 DRY RUN MODE - No files will be modified\n');
    }

    // Process each language
    let successCount = 0;
    const allMissingTranslations = {};

    for (const language of languagesToProcess) {
        try {
            if (options.dryRun) {
                // In dry run, just analyze without making API calls
                console.log(
                    `\n📊 Analyzing ${language} (${LANGUAGE_NAMES[language] || language})...`
                );

                let totalMissingKeys = 0;
                let allMissingForLanguage = [];

                // Get available translation files from base language
                const availableFiles = getAvailableTranslationFiles();

                // Process each translation file
                for (const filename of availableFiles) {
                    console.log(`\n  📄 Checking ${filename}...`);

                    const baseTranslations = loadTranslationFile(BASE_LANGUAGE, filename);
                    const targetTranslations = loadTranslationFile(language, filename);

                    if (Object.keys(baseTranslations).length === 0) {
                        console.warn(
                            `  ⚠️  Warning: Could not load base ${filename} for ${BASE_LANGUAGE}, skipping...`
                        );
                        continue;
                    }

                    const missingKeys = findMissingKeys(
                        baseTranslations,
                        targetTranslations
                    );

                    if (missingKeys.length === 0) {
                        console.log(`  ✅ ${filename}: All translations are up to date!`);
                        continue;
                    }

                    console.log(
                        `  📝 Found ${missingKeys.length} missing translation(s) in ${filename}`
                    );

                    totalMissingKeys += missingKeys.length;
                    
                    // Add filename prefix to paths for clarity
                    const prefixedMissingKeys = missingKeys.map(item => ({
                        ...item,
                        path: `${filename}:${item.path}`,
                        filename: filename
                    }));
                    
                    allMissingForLanguage.push(...prefixedMissingKeys);
                }

                console.log(
                    `\n📊 ${language}: Would update ${totalMissingKeys} missing translation(s) across ${availableFiles.length} files`
                );

                // Store missing translations for potential output
                if (totalMissingKeys > 0) {
                    allMissingTranslations[language] = {
                        languageName: LANGUAGE_NAMES[language] || language,
                        missingCount: totalMissingKeys,
                        missing: allMissingForLanguage.map((item) => ({
                            path: item.path,
                            englishValue: item.value,
                            isNested: item.isNested,
                            filename: item.filename,
                        })),
                    };
                }

                if (totalMissingKeys > 0) {
                    if (options.verbose) {
                        console.log(
                            `\n🔍 Detailed missing translations for ${language}:`
                        );
                        console.log('─'.repeat(60));

                        allMissingForLanguage.forEach((item, index) => {
                            const displayValue =
                                typeof item.value === 'string'
                                    ? item.value.length > 100
                                        ? item.value.substring(0, 97) + '...'
                                        : item.value
                                    : JSON.stringify(item.value);

                            console.log(
                                `${(index + 1).toString().padStart(3)}. ${item.path}`
                            );
                            console.log(`     📝 EN: "${displayValue}"`);
                            console.log(
                                `     🎯 ${LANGUAGE_NAMES[language] || language}: [MISSING]`
                            );

                            if (index < allMissingForLanguage.length - 1) {
                                console.log('');
                            }
                        });
                        console.log('─'.repeat(60));
                    }
                }
            } else {
                // Check API key for actual processing
                if (!OPENAI_API_KEY) {
                    console.error('❌ Error: OPENAI_API_KEY environment variable is required for actual translation updates');
                    console.error('Please set it with: export OPENAI_API_KEY="your-api-key"');
                    process.exit(1);
                }
                
                const success = await processLanguage(language);
                if (success) successCount++;
            }
        } catch (error) {
            console.error(`❌ Error processing ${language}: ${error.message}`);
        }
    }

    if (!options.dryRun) {
        console.log(
            `\n🎉 Completed! Successfully updated ${successCount}/${languagesToProcess.length} languages`
        );
    } else {
        // Show summary for dry run
        const totalMissing = Object.values(allMissingTranslations).reduce((sum, lang) => sum + lang.missingCount, 0);
        if (totalMissing > 0) {
            console.log(`\n📋 Summary: ${totalMissing} total missing translations across ${Object.keys(allMissingTranslations).length} languages`);
        }
        
        // Handle output file for dry run
        if (options.output && Object.keys(allMissingTranslations).length > 0) {
            const outputData = {
                generatedAt: new Date().toISOString(),
                baseLanguage: BASE_LANGUAGE,
                languages: allMissingTranslations,
                summary: {
                    totalLanguages: Object.keys(allMissingTranslations).length,
                    totalMissingTranslations: totalMissing,
                },
            };

            try {
                fs.writeFileSync(
                    options.output,
                    JSON.stringify(outputData, null, 2)
                );
                console.log(`💾 Missing translations saved to: ${options.output}`);
            } catch (error) {
                console.error(`❌ Error saving output file: ${error.message}`);
            }
        }
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    loadTranslationFile,
    findMissingKeys,
    createTranslationBatches,
    processLanguage,
};
