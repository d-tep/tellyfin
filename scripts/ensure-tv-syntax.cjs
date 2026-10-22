const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'jellyfin-tizen-fixed/node_modules');
const babel = require(path.join(modules, '@babel/core'));
const acorn = require(path.join(modules, 'acorn'));
const moduleParser = require(path.join(root, 'jellyfin-web-tizen-fix/node_modules/acorn'));
const preset = require.resolve(path.join(modules, '@babel/preset-env'));
let checked = 0;
let transformed = 0;
let modulesChecked = 0;
function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.name.endsWith('.js')) {
            let source = fs.readFileSync(file, 'utf8');
            try {
                acorn.parse(source, { ecmaVersion: 5, allowHashBang: true });
            } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
                console.log('Transforming ' + path.relative(root, file));
                const result = babel.transformSync(source, {
                    presets: [[preset, { targets: { chrome: '38' }, forceAllTransforms: true, modules: false, useBuiltIns: false }]],
                    sourceType: 'unambiguous', comments: true, compact: true,
                    babelrc: false, configFile: false, ast: true
                });
                source = result.code;
                const isModule = result.ast.program.sourceType === 'module';
                if (isModule) moduleParser.parse(source, { ecmaVersion: 2020, sourceType: 'module' });
                else acorn.parse(source, { ecmaVersion: 5, allowHashBang: true });
                if (isModule) modulesChecked++;
                fs.writeFileSync(file, source);
                transformed++;
            }
            checked++;
        }
    }
}
visit(path.join(root, 'jellyfin-tizen-fixed/www'));
console.log(`TV syntax verified: ${checked} JavaScript files; ${transformed} legacy transformations; ${modulesChecked} native module assets retaining imports/exports/import.meta.`);
