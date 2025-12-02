const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'all';

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            const startTime = new Date().toLocaleTimeString();
            console.log(`[watch] build started at ${startTime}`);
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location === null) { return; }
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    }
};

/**
 * Build configuration for VS Code extension
 */
const extensionConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [esbuildProblemMatcherPlugin],
};

/**
 * Build configuration for MCP server
 */
const mcpConfig = {
    entryPoints: ['src/mcp-server.ts'],
    bundle: true,
    format: 'esm',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/mcp-server.mjs',
    logLevel: 'warning',
    plugins: [esbuildProblemMatcherPlugin],
};

async function main() {
    const configs = [];
    
    if (mode === 'extension' || mode === 'all') {
        configs.push(extensionConfig);
    }
    
    if (mode === 'mcp' || mode === 'all') {
        configs.push(mcpConfig);
    }
    
    const contexts = await Promise.all(configs.map(config => esbuild.context(config)));
    
    if (watch) {
        await Promise.all(contexts.map(ctx => ctx.watch()));
    } else {
        await Promise.all(contexts.map(ctx => ctx.rebuild()));
        await Promise.all(contexts.map(ctx => ctx.dispose()));
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
