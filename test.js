
const test = require('tape')
const fs = require('fs')
const {exec} = require('child_process')
const collab = require('./index')

const SETTINGS = {
    manifest: 'test/dest/manifest.json',
    source: 'test/index.html',
    dest: 'test/dest/',
    multi: false,
    watch: 250,
}

test("getSettings()", assert => {
    
    {
        const actual = Object.keys(collab.getSettings());
        const expected = Object.keys(SETTINGS);
        assert.deepEqual(actual, expected,
            "default config contains all required keys");
    }
    {
        const actual = collab.getSettings("test/html.config.js");
        const expected = SETTINGS;
        assert.deepEqual(actual, expected,
            "config contains both custom and default settings");
    }
    assert.end();
})


test("Missing manifest", assert => {
    clean();
    
    const err = collab.main(SETTINGS);
    assert.ok(err > 0, "Should quit with error on a missing manifest file");
    assert.end();
})

test("Test single mode", assert => {
    clean();
    createManifest();
    collab.manifestCache = {};
    
    const err = collab.main(SETTINGS);
    if (err) assert.fail("Should not quit");
    
    const expected = fs.readFileSync('test/expected-single.html', 'utf-8');
    const actual = fs.readFileSync('test/dest/index.html', 'utf-8');
    
    assert.equal(
        expected, actual,
        '[index.html] should match [expected-single.html]'
    );
    assert.end();
})

test("Test multi mode", assert => {
    clean();
    createManifest();
    collab.manifestCache = {};
    
    const err = collab.main({...SETTINGS, multi: true});
    assert.notOk(err > 0, "should not quit");
    
    assert.equal(
        fs.readFileSync('test/dest/foo.html', 'utf-8'),
        fs.readFileSync('test/expected-foo.html', 'utf-8'),
        '[foo.html] should match [expected-foo.html]'
    );
    
    assert.equal(
        fs.readFileSync('test/dest/bar.html', 'utf-8'),
        fs.readFileSync('test/expected-bar.html', 'utf-8'),
        '[bar.html] should match [expected-bar.html]'
    );
    
    assert.notOk(
        fs.existsSync('test/dest/vendors.html'),
        '[vendors.html] should never exist'
    );
    assert.end();
})


// blindly and crudely removes test files
function clean() {
    try {
        for (let file of fs.readdirSync('test/dest')) {
            fs.unlinkSync(`test/dest/${file}`);
        }
    }
    catch(err) {}
}

// dump a fresh manifest file
function createManifest() {
    fs.writeFileSync('test/dest/manifest.json', JSON.stringify({
        'foo.js': '0.js',
        'bar.js': '1.js',
        'foo~bar.js': '2.js',
        'vendors~foo~bar.js': '3.js',
        'foo.css': '4.css',
        'foo~bar.css': '5.css',
    }, null, 2));
}
