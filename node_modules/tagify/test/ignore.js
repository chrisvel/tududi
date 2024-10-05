var test = require('tap').test;
var browserify = require('browserify');
var tagify = require('../lib/index.js');

var playground_dir = __dirname+'/playground-ignore/';

test('@browserify-ignore', function (t) {
    
    var bundle = browserify();
    bundle.use(tagify);
    bundle.addEntry(playground_dir+'index.js');

    t.ok(bundle.ignoring['./bar.js']);
    t.ok(bundle.ignoring['dgram']);

    t.end();
});