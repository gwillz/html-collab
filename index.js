#!/usr/bin/env nodejs
const fs     = require('fs')
const path   = require('path')
const equals = require('array-equal')
const chalk  = require('chalk')

const HEAD_INSERT = '<!-- HEAD BUNDLES -->';
const MAIN_INSERT = '<!-- MAIN BUNDLES -->';
const COLUMN_WIDTH = 60;

const manifestCache = {};

const DEFAULT_CONFIG = {
    manifest: './manifest.json',
    watch: 250,
    multi: false,
    source: 'src/index.html',
    dest: 'public/',
};

/**
 * manifest.json contains hashed filenames of js/css files from _both_
 * webpack and postcss
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
        return 0;
    }
    //
    run(manifest, settings, path.basename(settings.source));
    return 0;
}


function run(manifest, settings, dest_name) {
    const cache = manifestCache[dest_name] || {};
    
    // quit early if this manifest has already been processed
    if (equals(Object.values(cache), Object.values(manifest))) return 0;
    
    let indexfile  = fs.readFileSync(settings.source);
    
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
    
    manifestCache[dest_name] = manifest;
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


function getSettings(config_path) {
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
}


// --- runtime ---

if (require.main === module) {
    const settings = Object.assign(DEFAULT_CONFIG, getSettings(process.argv[2]));
    
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
