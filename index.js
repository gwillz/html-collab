#!/usr/bin/env nodejs
const fs     = require('fs')
const path   = require('path')
const equals = require('array-equal')
const chalk  = require('chalk')

const HEAD_INSERT = '<!-- HEAD BUNDLES -->'
const MAIN_INSERT = '<!-- MAIN BUNDLES -->'

let manifestCache = {};

/**
 * manifest.json contains hashed filenames of js/css files from _both_
 * webpack and postcss
 */
function main(manifest_path, source, dest) {
    if (!fs.existsSync(manifest_path)) {
        console.log(chalk.red("manifest file not found"));
        console.log('-----------');
        return 1;
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifest_path));
      
    let indexfile  = fs.readFileSync(source);
    
    const keys = Object.keys(manifest)
    const cached = keys.filter(key => (
        manifestCache[key] === manifest[key]
    ))
    
    // quit early if this manifest has already been processed
    if (equals(Object.values(manifestCache), Object.values(manifest))) return;
    
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
        if (value !== manifestCache[key]) {
            console.log(chalk.green(value.padEnd(40)), key);
        }
        else {
            console.log(value.padEnd(40), key);
        }
    }
    
    fs.writeFileSync(dest, indexfile);
    console.log('-----------');
    
    manifestCache = manifest;
    return 0;
}


/**
 * Update the file asap when webpack/postcss have updated the mainfest
 */
function watch(manifest_path, source, dest, timeout) {
    const watch_path = path.dirname(path.resolve(manifest_path));
    let timer;
    
    fs.watch(watch_path, {encoding: 'utf8'}, (event, filename) => {
        if (manifest_path.endsWith(filename)) {
            try {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    main(manifest_path, source, dest);
                }, timeout);
            }
            catch (e) {
                console.error("Error:", e);
            }
        }
    })
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
    const DEFAULT = {
        manifest: './manifest.json',
        watch: 150,
        source: 'src/index.html',
        dest: 'public/index.html',
    }
    
    if (config_path) {
        config_path = path.resolve(process.cwd(), config_path);
        return Object.assign(DEFAULT, require(config_path));
    }
    try {
        config_path = path.resolve(process.cwd(), 'html.config.js');
        return Object.assign(DEFAULT, require(config_path));
    }
    catch (e) {
        return DEFAULT;
    }
}


// --- runtime ---

if (require.main === module) {
    const settings = getSettings(process.argv[2]);
    
    if (process.argv.includes('watch')) {
        console.log('watching:', chalk.blue(settings.manifest), chalk.red(`(${settings.watch}ms)`))
        console.log('-----------')
        watch(settings.manifest, settings.source, settings.dest, settings.watch)
        main(settings.manifest, settings.source, settings.dest)
    }
    else {
        console.log('processing', settings.manifest)
        console.log('-----------')
        process.exit(main(settings.manifest, settings.source, settings.dest))
    }
}
