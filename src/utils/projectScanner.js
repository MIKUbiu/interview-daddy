const fs = require('fs');
const path = require('path');

// Directories that never carry useful "what is this project" signal for an interview.
const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', '.next', '.nuxt',
    'target', 'bin', 'obj', 'vendor', 'coverage', '.idea', '.vscode', '.cache',
    '__pycache__', '.pytest_cache', '.mypy_cache', 'venv', '.venv', 'env',
    '.gradle', '.dart_tool', 'Pods', 'DerivedData', '.terraform', 'tmp', 'temp',
]);

// Source extensions we're willing to excerpt from.
const CODE_EXT = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.kt', '.go', '.rs', '.rb',
    '.php', '.c', '.h', '.cpp', '.hpp', '.cs', '.swift', '.m', '.mm', '.scala',
    '.vue', '.svelte', '.dart', '.sql',
]);

// Entry-point filename stems we prioritise for excerpting.
const ENTRY_STEMS = ['main', 'index', 'app', 'server', 'application', '__init__'];

// Budgets (characters) to keep the injected context sane for the model.
const README_BUDGET = 8000;
const TREE_MAX_ENTRIES = 220;
const TREE_MAX_DEPTH = 4;
const FILE_EXCERPT_LINES = 55;
const MAX_EXCERPT_FILES = 5;
const TOTAL_BUDGET = 32000;

function safeRead(filePath, maxBytes = 200000) {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size > maxBytes) return null;
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}

function truncate(str, max) {
    if (str.length <= max) return str;
    return str.slice(0, max) + `\n... [truncated, ${str.length - max} more chars]`;
}

// ── README ──

function findReadme(root) {
    let entries;
    try {
        entries = fs.readdirSync(root);
    } catch {
        return null;
    }
    const match = entries.find(e => /^readme(\.(md|markdown|txt|rst))?$/i.test(e));
    if (!match) return null;
    const content = safeRead(path.join(root, match));
    return content ? { name: match, content } : null;
}

// ── Dependency / tech-stack manifests ──

function summarizeManifests(root) {
    const parts = [];
    const tech = new Set();

    const pkgRaw = safeRead(path.join(root, 'package.json'));
    if (pkgRaw) {
        tech.add('Node.js / JavaScript');
        try {
            const pkg = JSON.parse(pkgRaw);
            const lines = [];
            if (pkg.name) lines.push(`name: ${pkg.name}`);
            if (pkg.description) lines.push(`description: ${pkg.description}`);
            if (pkg.scripts) lines.push(`scripts: ${Object.keys(pkg.scripts).join(', ')}`);
            const deps = Object.keys(pkg.dependencies || {});
            const devDeps = Object.keys(pkg.devDependencies || {});
            if (deps.length) lines.push(`dependencies: ${deps.join(', ')}`);
            if (devDeps.length) lines.push(`devDependencies: ${devDeps.join(', ')}`);
            parts.push(`**package.json**\n${lines.join('\n')}`);
            // Framework hints
            const allDeps = [...deps, ...devDeps].join(' ');
            if (/\breact\b/.test(allDeps)) tech.add('React');
            if (/\bvue\b/.test(allDeps)) tech.add('Vue');
            if (/\b@angular\b/.test(allDeps)) tech.add('Angular');
            if (/\bnext\b/.test(allDeps)) tech.add('Next.js');
            if (/\bexpress\b/.test(allDeps)) tech.add('Express');
            if (/\bnestjs\b|@nestjs/.test(allDeps)) tech.add('NestJS');
            if (/typescript/.test(allDeps)) tech.add('TypeScript');
        } catch {
            parts.push('**package.json** (present, unparseable)');
        }
    }

    const simpleManifests = [
        ['requirements.txt', 'Python'],
        ['pyproject.toml', 'Python'],
        ['Pipfile', 'Python'],
        ['go.mod', 'Go'],
        ['Cargo.toml', 'Rust'],
        ['pom.xml', 'Java / Maven'],
        ['build.gradle', 'Java / Gradle'],
        ['build.gradle.kts', 'Kotlin / Gradle'],
        ['composer.json', 'PHP'],
        ['Gemfile', 'Ruby'],
        ['pubspec.yaml', 'Dart / Flutter'],
        ['CMakeLists.txt', 'C / C++'],
        ['Dockerfile', 'Docker'],
    ];

    for (const [file, label] of simpleManifests) {
        const raw = safeRead(path.join(root, file));
        if (raw) {
            tech.add(label);
            parts.push(`**${file}**\n${truncate(raw.trim(), 1500)}`);
        }
    }

    return { manifestText: parts.join('\n\n'), tech: [...tech] };
}

// ── Directory tree ──

function buildTree(root) {
    const lines = [];
    let count = 0;
    let truncated = false;

    function walk(dir, prefix, depth) {
        if (truncated || depth > TREE_MAX_DEPTH) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        entries = entries
            .filter(e => !e.name.startsWith('.') || e.name === '.env.example')
            .filter(e => !(e.isDirectory() && IGNORE_DIRS.has(e.name)))
            .sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

        for (const entry of entries) {
            if (count >= TREE_MAX_ENTRIES) {
                truncated = true;
                lines.push(`${prefix}... [more entries omitted]`);
                return;
            }
            count++;
            lines.push(`${prefix}${entry.name}${entry.isDirectory() ? '/' : ''}`);
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name), prefix + '  ', depth + 1);
            }
        }
    }

    walk(root, '', 0);
    return lines.join('\n');
}

// ── Entry-point source excerpts ──

function collectEntryFiles(root) {
    const found = [];

    function walk(dir, depth) {
        if (found.length >= MAX_EXCERPT_FILES || depth > 3) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (found.length >= MAX_EXCERPT_FILES) return;
            if (entry.isDirectory()) {
                if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                walk(path.join(dir, entry.name), depth + 1);
            } else {
                const ext = path.extname(entry.name).toLowerCase();
                const stem = path.basename(entry.name, ext).toLowerCase();
                if (CODE_EXT.has(ext) && ENTRY_STEMS.includes(stem)) {
                    found.push(path.join(dir, entry.name));
                }
            }
        }
    }

    walk(root, 0);
    return found;
}

function excerptFiles(root, files) {
    const parts = [];
    for (const file of files) {
        const content = safeRead(file);
        if (!content) continue;
        const rel = path.relative(root, file).replace(/\\/g, '/');
        const lines = content.split('\n').slice(0, FILE_EXCERPT_LINES).join('\n');
        parts.push(`**${rel}**\n\`\`\`\n${lines}\n\`\`\``);
    }
    return parts.join('\n\n');
}

// ── Public API ──

function scanProject(root) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        throw new Error('Path is not a directory: ' + root);
    }

    const projectName = path.basename(root);
    const readme = findReadme(root);
    const { manifestText, tech } = summarizeManifests(root);
    const tree = buildTree(root);
    const entryFiles = collectEntryFiles(root);
    const excerpts = excerptFiles(root, entryFiles);

    const sections = [];
    sections.push(`# MY PROJECT: ${projectName}`);
    sections.push(
        `The following is context about a real project the candidate built. When the interviewer asks about "your project", "your experience", architecture, tech choices, or design decisions, ground your answers in these actual details. Speak in first person as the candidate.`
    );

    if (tech.length) {
        sections.push(`## Tech Stack\n${tech.join(', ')}`);
    }
    if (readme) {
        sections.push(`## README (${readme.name})\n${truncate(readme.content.trim(), README_BUDGET)}`);
    }
    if (manifestText) {
        sections.push(`## Dependencies & Build\n${manifestText}`);
    }
    if (tree) {
        sections.push(`## Project Structure\n\`\`\`\n${tree}\n\`\`\``);
    }
    if (excerpts) {
        sections.push(`## Key Entry-Point Files\n${excerpts}`);
    }

    let context = sections.join('\n\n');
    context = truncate(context, TOTAL_BUDGET);

    return {
        context,
        stats: {
            path: root,
            name: projectName,
            tech,
            chars: context.length,
            fileExcerpts: entryFiles.map(f => path.relative(root, f).replace(/\\/g, '/')),
            hasReadme: !!readme,
        },
    };
}

module.exports = { scanProject, IGNORE_DIRS, CODE_EXT };
