// tools/fix-wxml-entities.js
// Replace HTML numeric character references (&#xXXXX; and &#xXXXXXX;)
// in WXML files with actual Unicode characters.
//
// Usage: node tools/fix-wxml-entities.js
// Dry-run: node tools/fix-wxml-entities.js --dry-run

const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..', 'app');
const DRY_RUN = process.argv.includes('--dry-run');

// Matches &#xXXXX; or &#xXXXXXX; (hex digits, 1-6 chars)
const ENTITY_RE = /&#x([0-9A-Fa-f]{1,6});/g;

function* walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else if (entry.name.endsWith('.wxml')) {
      yield full;
    }
  }
}

let totalFiles = 0;
let totalReplacements = 0;

for (const filePath of walkDir(APP_DIR)) {
  const original = fs.readFileSync(filePath, 'utf8');
  let modified = original;
  let fileReplacements = 0;

  modified = modified.replace(ENTITY_RE, (match, hex) => {
    const codePoint = parseInt(hex, 16);
    const char = String.fromCodePoint(codePoint);
    fileReplacements++;
    return char;
  });

  if (fileReplacements > 0) {
    totalFiles++;
    totalReplacements += fileReplacements;

    if (DRY_RUN) {
      console.log(`[DRY-RUN] ${path.relative(APP_DIR, filePath)}: ${fileReplacements} replacements`);
      // Show first few replacements
      let count = 0;
      original.replace(ENTITY_RE, (match, hex) => {
        if (count < 5) {
          const codePoint = parseInt(hex, 16);
          const char = String.fromCodePoint(codePoint);
          console.log(`  ${match} → ${char} (U+${hex.toUpperCase()})`);
          count++;
        }
      });
      if (fileReplacements > 5) console.log(`  ... and ${fileReplacements - 5} more`);
    } else {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`[FIXED] ${path.relative(APP_DIR, filePath)}: ${fileReplacements} replacements`);
    }
  }
}

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Total: ${totalFiles} files, ${totalReplacements} replacements`);
if (DRY_RUN) {
  console.log('Run without --dry-run to apply changes.');
}