# HTML from Metadata

A script that injects dependencies from a `manifest.json` into an HTML template.

## Haha. What?

Webpack and PostCSS are both fantastic tools, and although there are already
integrations between them, sometimes I don't like my peas and gravy touching.
(I'm talking about inline styles vs standalone CSS).

If you're the type who still uses standalone stylesheets that aren't touched
by javascript at runtime or have mangled class names; then this package is for you!

This script will inject dependencies into a template HTML file for both
Webpack and PostCSS assets.

## Yeah, how?

This script isn't dependent on PostCSS or Webpack. Only any program that
outputs a `manifest.json` file.

 * Webpack does this with the
   [webpack-asset-manifest](//www.npmjs.com/package/webpack-assets-manifest) plugin.
 * PostCSS does this with the
   [postcss-hash](//npmjs.com/package/postcss-hash) plugin.
 * Others, idk.

Fundamentally, this script knows nothing of either and blindly injects
dependencies into an HTML file. But our use-case involves them, so we're
going to talk about them.

## Usage

Load up **webpack-asset-manifest** like this:
```js
// in webpack.config.js
plugins: [
    new WebpackAssetsManifest({
        output: "./manifest.json",
        merge: true,
        writeToDisk: true,
        sortManifest: false,
    }),
]
```

Load up **postcss-hash** like this:
```js
// in postcss.config.js
plugins: {
    "postcss-hash": {
        manifest: "./manifest.json",
    },
}
```

Create a `html.config.js` file like this:
```js
// these are also the defaults
module.exports = {
    manifest: "./manifest.json",
    source: "src/index.html",
    dest: "public/",
    multi: false,
    watch: 250,
}
```

Then run all three programs:
```sh
npx webpack -c webpack.config.js
npx postcss -c postcss.config.js
npx collab-html html.config.js
```

You can also watch for changes on `manifest.json` with:

`npx html-collab html.config.js watch`


## Configuration

 * `manifest:` the manifest file path
 * `source`: the template HTML file, (more below)
 * `dest:` directory for output files
 * `multi:` collate or separate files, (more below)
 * `watch:` polling rate

You can specify the config file via the first argument, or by placing it in
the working directory.

### Source template file

The template is any old HTML file, with a few anchor comments so `html-collab`
knows where to place things.

Put `<!-- HEAD BUNDLES -->` in your `<head>` tag. This is where vendor files and
CSS files are inserted.

Put `<!-- MAIN BUNDLES -->` at the bottom of your `<body>` tag. This is where
your entry JS files are inserted.

An example is available at `test/index.html`.


### Multiple Entries

Old mate Webpack will export different chunks with different bits of code
that apply appropriately to it's various entry files. In that case, we want
multiple corresponding entry HTML files, instead of mindlessly bunching all
of the assets into one.

For this, flick the `multi:` config to `true`.

An example, a `manifest.json`:
```json
{
    "vendors~index~hey": "1.js",
    "vendors~index": "2.js",
    "index": "3.js",
    "hey": "4.js"
}
```
becomes:
```json
{
    "index": {
        "vendors~index~key": "1.js",
        "vendors~index": "2.js",
        "index": "3.js"
    },
    "hey": {
        "vendors~index~key": "1.js",
        "hey": "4.js"
    }
}
```

This creates two files, `index.html` and `hey.html`.

Note; the 'vendors' key does not create a unique entry.

You can have PostCSS play along with this by copying the naming scheme.
Like so;

 * `index.css` will go into the `index.html` entry.
 * `index.hey.css` will go into both `index.html` and `hey.html`.



## TODOS
 * use `require.resolve()` to find the `html.config.js` file
 * use a HTML parser to insert the assets instead of anchor comments
 * a better name?
