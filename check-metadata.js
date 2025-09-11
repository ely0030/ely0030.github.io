import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if a file has proper metadata
function checkMetadata(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Check if file starts with ---
    if (!lines[0] || !lines[0].trim().startsWith('---')) {
        return { valid: false, error: 'Missing frontmatter (no --- at start)' };
    }
    
    // Find the end of frontmatter
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            endIndex = i;
            break;
        }
    }
    
    if (endIndex === -1) {
        return { valid: false, error: 'Missing closing --- in frontmatter' };
    }
    
    // Parse frontmatter
    const frontmatter = lines.slice(1, endIndex).join('\n');
    const metadata = {};
    
    frontmatter.split('\n').forEach(line => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            metadata[key] = value === '' ? null : value;
        }
    });
    
    // Check required fields
    const errors = [];
    
    if (!metadata.title) {
        errors.push('Missing title');
    }
    
    if (!metadata.pubDate) {
        errors.push('Missing pubDate');
    } else if (metadata.pubDate === 'null' || metadata.pubDate === '') {
        errors.push('pubDate is empty or null');
    }
    
    if (!metadata.description) {
        errors.push('Missing description');
    } else if (metadata.description === 'null' || metadata.description === '') {
        errors.push('description is empty or null');
    }
    
    if (errors.length > 0) {
        return { valid: false, errors, metadata };
    }
    
    return { valid: true, metadata };
}

// Function to recursively find all markdown files
function findMarkdownFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            findMarkdownFiles(fullPath, files);
        } else if (item.endsWith('.md')) {
            files.push(fullPath);
        }
    });
    
    return files;
}

// Main execution
console.log('🔍 Checking metadata for all blog files...\n');

const blogDir = path.join(__dirname, 'src/content/blog');
const files = findMarkdownFiles(blogDir);
let hasErrors = false;

files.forEach(file => {
    const relativePath = path.relative(__dirname, file);
    const result = checkMetadata(file);
    
    if (!result.valid) {
        hasErrors = true;
        console.log(`❌ ${relativePath}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        } else if (result.errors) {
            result.errors.forEach(error => console.log(`   - ${error}`));
        }
        if (result.metadata) {
            console.log('   Current metadata:', JSON.stringify(result.metadata, null, 2));
        }
        console.log('');
    }
});

if (!hasErrors) {
    console.log('✅ All files have proper metadata!');
} else {
    console.log(`\n⚠️  Found metadata issues in the files listed above.`);
    console.log('Please fix these issues before continuing.');
}

console.log(`\n📊 Checked ${files.length} files total.`);
