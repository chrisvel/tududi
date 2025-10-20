#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/components/Profile/ProfileSettings.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Add imports after the existing imports
const importToAdd = `import {
    getTimezonesByRegion,
    getRegionDisplayName,
} from '../../utils/timezoneUtils';`;

// Find the last import statement before interfaces
const lastImportMatch = content.match(/(import.*from.*';[\r\n]+)(\r\n)(interface)/);
if (lastImportMatch) {
    content = content.replace(
        lastImportMatch[0],
        `${lastImportMatch[1]}${importToAdd}\n${lastImportMatch[2]}${lastImportMatch[3]}`
    );
}

// Step 2: Add useMemo after const [activeTab...
const useMemoToAdd = `
    // Generate timezone list using date-fns-tz and Intl API
    const timezonesByRegion = React.useMemo(() => {
        return getTimezonesByRegion();
    }, []);
`;

content = content.replace(
    /(const \[activeTab, setActiveTab\] = useState\('general'\);)/,
    `$1${useMemoToAdd}`
);

// Step 3: Replace the entire hardcoded timezone section
// Find the start: <option value="UTC">UTC</option> followed by {/* Americas */}
// Find the end: last </optgroup> before </select>

const timezoneReplacement = `                                    <option value="UTC">UTC</option>

                                    {/* Dynamically generated timezone list */}
                                    {Object.keys(timezonesByRegion)
                                        .sort()
                                        .map((region) => (
                                            <optgroup
                                                key={region}
                                                label={getRegionDisplayName(
                                                    region
                                                )}
                                            >
                                                {timezonesByRegion[region].map(
                                                    (tz) => (
                                                        <option
                                                            key={tz.value}
                                                            value={tz.value}
                                                        >
                                                            {tz.label}
                                                        </option>
                                                    )
                                                )}
                                            </optgroup>
                                        ))}`;

// Match from <option value="UTC">UTC</option> to the last </optgroup> before </select>
const timezonePattern = /(<option value="UTC">UTC<\/option>)([\s\S]*?)(<\/optgroup>\s*<\/select>)/;
content = content.replace(timezonePattern, `$1\n\n${timezoneReplacement}\n                                </select>`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ ProfileSettings.tsx updated successfully with dynamic timezone list!');
