var test = require('tap').test;
var browserify = require('browserify');
var tagify = require('../lib/index.js');

var playground_dir = __dirname+'/playground-alias/';

test('@browserify-alias', function (t) {
    
    var bundle = browserify();
    bundle.use(tagify);
    bundle.addEntry(playground_dir+'index.js');

    t.equals(bundle.aliases['nope'], 'foo');
    t.equals(bundle.aliases['nope-bis'], 'foo-bis');
    
    t.end();
});