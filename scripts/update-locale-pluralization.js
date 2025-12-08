#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Translations for different languages with proper pluralization
const translations = {
  es: {
    one: '1 problema de productividad necesita atención',
    other: '{{count}} problemas de productividad necesitan atención'
  },
  fr: {
    one: '1 problème de productivité nécessite une attention',
    other: '{{count}} problèmes de productivité nécessitent une attention'
  },
  de: {
    one: '1 Produktivitätsproblem benötigt Aufmerksamkeit',
    other: '{{count}} Produktivitätsprobleme benötigen Aufmerksamkeit'
  },
  it: {
    one: '1 problema di produttività necessita attenzione',
    other: '{{count}} problemi di produttività necessitano attenzione'
  },
  pt: {
    one: '1 problema de produtividade precisa de atenção',
    other: '{{count}} problemas de produtividade precisam de atenção'
  },
  nl: {
    one: '1 productiviteitsprobleem heeft aandacht nodig',
    other: '{{count}} productiviteitsproblemen hebben aandacht nodig'
  },
  ru: {
    one: '1 проблема с продуктивностью требует внимания',
    other: '{{count}} проблем с продуктивностью требуют внимания'
  },
  pl: {
    one: '1 problem z produktywnością wymaga uwagi',
    other: '{{count}} problemów z produktywnością wymaga uwagi'
  },
  tr: {
    one: '1 verimlilik sorunu dikkat gerektiriyor',
    other: '{{count}} verimlilik sorunu dikkat gerektiriyor'
  },
  sv: {
    one: '1 produktivitetsproblem behöver uppmärksammas',
    other: '{{count}} produktivitetsproblem behöver uppmärksammas'
  },
  no: {
    one: '1 produktivitetsproblem trenger oppmerksomhet',
    other: '{{count}} produktivitetsproblemer trenger oppmerksomhet'
  },
  da: {
    one: '1 produktivitetsproblem kræver opmærksomhed',
    other: '{{count}} produktivitetsproblemer kræver opmærksomhed'
  },
  fi: {
    one: '1 tuottavuusongelma tarvitsee huomiota',
    other: '{{count}} tuottavuusongelmaa tarvitsee huomiota'
  },
  // For Asian languages that don't have plural forms, use 'other' for all
  zh: {
    other: '{{count}}个生产力问题需要关注'
  },
  jp: {
    other: '{{count}}の生産性の問題に注意が必要です'
  },
  ko: {
    other: '{{count}}개의 생산성 문제에 주의가 필요합니다'
  },
  vi: {
    other: '{{count}} vấn đề năng suất cần được chú ý'
  },
  id: {
    other: '{{count}} masalah produktivitas memerlukan perhatian'
  },
  ar: {
    other: '{{count}} مشكلة في الإنتاجية تحتاج إلى اهتمام'
  },
  el: {
    one: '1 θέμα παραγωγικότητας χρειάζεται προσοχή',
    other: '{{count}} θέματα παραγωγικότητας χρειάζονται προσοχή'
  },
  ro: {
    one: '1 problemă de productivitate necesită atenție',
    other: '{{count}} probleme de productivitate necesită atenție'
  },
  bg: {
    one: '1 проблем с производителността изисква внимание',
    other: '{{count}} проблема с производителността изискват внимание'
  },
  sl: {
    one: '1 težava s produktivnostjo potrebuje pozornost',
    other: '{{count}} težav s produktivnostjo potrebuje pozornost'
  },
  ua: {
    one: '1 проблема з продуктивністю потребує уваги',
    other: '{{count}} проблем з продуктивністю потребують уваги'
  }
};

const localesDir = path.join(__dirname, '..', 'public', 'locales');

// Get all locale directories
const locales = fs.readdirSync(localesDir).filter(file => {
  const fullPath = path.join(localesDir, file);
  return fs.statSync(fullPath).isDirectory();
});

console.log(`Updating ${locales.length} locale files...`);

locales.forEach(locale => {
  // Skip English as it's already updated
  if (locale === 'en') {
    console.log(`Skipping ${locale} (already updated)`);
    return;
  }

  const translationFile = path.join(localesDir, locale, 'translation.json');

  if (!fs.existsSync(translationFile)) {
    console.log(`Skipping ${locale} (translation.json not found)`);
    return;
  }

  try {
    const content = fs.readFileSync(translationFile, 'utf8');
    const json = JSON.parse(content);

    // Check if issuesFound exists
    if (json.productivity && json.productivity.issuesFound) {
      // Remove the old key
      delete json.productivity.issuesFound;

      // Add new pluralized keys
      const trans = translations[locale];
      if (trans) {
        if (trans.one) {
          json.productivity.issuesFound_one = trans.one;
        }
        json.productivity.issuesFound_other = trans.other;

        // Write back to file
        fs.writeFileSync(translationFile, JSON.stringify(json, null, 2) + '\n', 'utf8');
        console.log(`✓ Updated ${locale}`);
      } else {
        console.log(`⚠ No translation available for ${locale} - skipping`);
      }
    } else {
      console.log(`⚠ issuesFound not found in ${locale}`);
    }
  } catch (error) {
    console.error(`✗ Error updating ${locale}:`, error.message);
  }
});

console.log('\nDone!');
