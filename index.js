#!/usr/bin/env nodejs

const fs     = require('fs')
const path   = require('path')
const equals = require('array-equal')
const chalk  = require('chalk')

const HEAD_INSERT = '<!-- HEAD BUNDLES -->';
const MAIN_INSERT = '<!-- MAIN BUNDLES -->';
const COLUMN_WIDTH = 60;

exports.manifestCache = {};

const DEFAULT_CONFIG = {
    manifest: './manifest.json',    // source mainfest
    source: 'src/index.html',       // source .html template
    dest: 'public/',                // output directory
    multi: false,                   // create mutliple entry .html files
    watch: 250,                     // watch polling rate
};

/**
 * This injects js/css dependencies into an .html as defined by
 * a 'manifest.json'. This is important for two reasons:
 *  - de-duplication of delivered code
 *  - cache busting with filename hashes
 *
 * Manifest files are created by both webpack and postcss with these plugins.
 * These will collaborate on the same 'manifest.json':
 * - webpack-assets-manifest
 * - postcss-hash
 *
 * A simple example:
 *  - index.html contains no js/css
 *  - manifest.json contains js/css for 2 entry files as 4 chunks:
 *    1. shared css
 *    2. shared vendor js
 *    3. local js for entry 1
 *    4. local js for entry 2
 *  - an entry-1.html is created with chunks 1, 2 and 3
 *  - an entry-2.html is created with chunks 1, 2 and 4
 */
function main(settings) {
    settings = Object.assign(DEFAULT_CONFIG, settings);
    
    // pretty error if manifest not found
    if (!fs.existsSync(settings.manifest)) {
        console.log(chalk.red("manifest file not found"));
        console.log('-----------');
        return 1;
    }
    
    const manifest = JSON.parse(fs.readFileSync(settings.manifest));
    
    if (settings.multi) {
        const filtered = filterManifest(manifest);
        
        for (let name in filtered) {
            run(filtered[name], settings, name + ".html");
        }
    }
    else {
        run(manifest, settings, path.basename(settings.source));
    }
    return 0;
}


/**
 * Create an entry file with injected dependencies as per given 'manifest'
 */
function run(manifest, settings, dest_name) {
    const cache = exports.manifestCache[dest_name] || {};
    
    // quit early if this manifest has already been processed
    if (equals(Object.values(cache), Object.values(manifest))) return 0;
    
    let indexfile = fs.readFileSync(settings.source);
    
    for (let key in manifest) {
        let value = manifest[key];
        
        if (value.endsWith('.css')) {
            indexfile = insertAsset(indexfile, value, 'css')
        }
        else if (value.endsWith('.js') && key.includes('vendor')) {
            indexfile = insertAsset(indexfile, value, 'vendorjs');
        }
        else if (value.endsWith('.js')) {
            indexfile = insertAsset(indexfile, value, 'mainjs');
        }
        else {
            continue;
        }
        
        // green if changed, regular if not
        console.log((value !== cache[key])
                ? chalk.green(value.padEnd(COLUMN_WIDTH))
                : value.padEnd(COLUMN_WIDTH), key);
    }
    
    const dest_path = path.resolve(settings.dest, dest_name);
    fs.writeFileSync(dest_path, indexfile);
    console.log(dest_path);
    console.log('-----------');
    
    exports.manifestCache[dest_name] = manifest;
}


/**
 * Update the file asap when webpack/postcss have updated the mainfest
 */
function watch(settings) {
    const watch_path = path.dirname(path.resolve(settings.manifest));
    let timer;
    
    // watch the whole path, then match for event within
    // this avoids errors when cleaning/deleting manifest.json
    fs.watch(watch_path, {encoding: 'utf8'}, (event, filename) => {
        if (settings.manifest.endsWith(filename)) {
            try {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    main(settings);
                }, settings.watch);
            }
            catch (e) {
                console.error("Error:", e);
            }
        }
    })
}

/**
 * Find common chunks within keys, group by keys.
 * E.g:
 *   'vendor~index~hey': '1.js',
 *   'vendor~index': '2.js',
 *   'index': '3.js',
 *   'hey': '4.js'
 * becomes:
 *   'index': {
 *       'vendor~index~key': '1.js',
 *       'vendor~index': '2.js',
 *       'index': '3.js'
 *   },
 *   'hey': {
 *       'vendor~index~key': '1.js',
 *       'hey': '4.js'
 *   }
 */
function filterManifest(manifest) {
    const filtered = {};
    
    // find unique chunks, excluding vendors
    for (let key in manifest) {
        const name = key.match(/^([^~.$]+)[~.$]/)[1];
        if (name === 'vendors') continue;
        filtered[name] = filtered[name] || {};
    }
    
    // filter appropriate manifest entries into chunk slots
    for (let key in manifest) {
        for (let name in filtered) {
            if (key.includes(name)) {
                filtered[name][key] = manifest[key];
            }
        }
    }
    return filtered;
}

/**
 * Inject js/css as script/link, respectively.
 * - 'vendorjs' and 'css' should be injected into the <head>
 * - 'mainjs' is injected at the very end of the <body>
 */
function insertAsset(indexfile, value, type) {
    let point;
    let insert;
    
    // determine insert type, point of insert, etc
    switch (type) {
        case 'css':
            point = indexfile.indexOf(HEAD_INSERT)
            insert = `<link rel="stylesheet" type="text/css" href="/${value}">`
            break
            
        case 'vendorjs':
            point = indexfile.indexOf(HEAD_INSERT)
            insert = `<script type="text/javascript" src="/${value}"></script>`
            break
            
        case 'mainjs':
            point = indexfile.indexOf(MAIN_INSERT)
            insert = `<script type="text/javascript" src="/${value}"></script>`
            break
            
        default:
            console.log('error:', `unknown asset type '${type}'`)
            return indexfile
    }
    
    // do the insert
    return indexfile.slice(0, point) +
           insert + '\n    ' +
           indexfile.slice(point)
}


/**
 * Configurations loaded from file are applied over default settings.
 * 'config_path' resolving:
 * - path is a file
 * - path is a directory, containing 'html.config.js'
 * - not found, use defaults
 */
function getSettings(config_path) {
    const settings = (function() {
        if (config_path) {
            config_path = path.resolve(process.cwd(), config_path);
            return require(config_path);
        }
        try {
            config_path = path.resolve(process.cwd(), 'html.config.js');
            return require(config_path);
        }
        catch (e) {
            return {};
        }
    })();
    return Object.assign(DEFAULT_CONFIG, settings);
}


// exports for tests
exports.main = main;
exports.run = run;
exports.insertAsset = insertAsset;
exports.filterManifest = filterManifest;
exports.getSettings = getSettings;


// --- runtime ---

/* istanbul ignore next */
if (require.main === module) {
    const settings = getSettings(process.argv[2]);
    
    if (process.argv.includes('watch')) {
        console.log('watching:', chalk.blue(settings.manifest), chalk.red(`(${settings.watch}ms)`))
        console.log('-----------')
        watch(settings)
        main(settings)
    }
    else {
        console.log('processing', settings.manifest)
        console.log('-----------')
        process.exit(main(settings))
    }
}
