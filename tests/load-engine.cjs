/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS loader for Node tests */
/* Loads the browser engine (public/engine) in Node for the tests: the Emscripten glue,
 * Seeder's wrapper and Seed Studio's structure layer, exactly the files the site serves. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..', 'public', 'engine') + path.sep;

module.exports = () => new Promise((resolve, reject) => {
    const ctx = {
        console, require, process, URL, TextDecoder, TextEncoder, WebAssembly, setTimeout, clearTimeout, performance,
        __dirname: DIR, __filename: DIR + 'api.js', module: { exports: {} }, postMessage: () => {},
    };
    ctx.globalThis = ctx; ctx.self = ctx;
    ctx.Module = {
        locateFile: (p) => DIR + p,
        onRuntimeInitialized: () => { ctx.engine = new ctx.Seeder(ctx.Module); resolve(ctx); },
        onAbort: reject,
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(DIR + 'api.js', 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(DIR + 'seeder.js', 'utf8') + ';globalThis.Seeder = Seeder;', ctx);
    vm.runInContext(fs.readFileSync(DIR + 'structures.js', 'utf8'), ctx);
});
