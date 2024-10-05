[Browserify](https://github.com/substack/node-browserify) middleware for embedded compilation options.

Thanks to specific tags placed in your code you can take control on your bundle : add aliases, ignore
modules, modify on the fly the code, and so on..

Tagify comes *ad-hoc* with two handy tags, *alias* and *ignore* : see below how to use them.. 

# Installation

```bash
$ npm install tagify
```

# Compatibility

*tagify* is compatible with brwoserify v1.

# Usage

Tagify is a browserify middleware :

```js
var b = require('browserify')();
b.use(require('tagify'))
```

And then throw tags in your code :

```js
//@browserify-tag {OPTIONS}
var d = function() .....
```

## ignore tag

```js
//@browserify-ignore
var fs = require('fs');
```

Placed in front of a require statement, the required module will be added to the list of ignored modules.
Here it actually does `b.ignore('fs')`.

```js
//@browserify-ignore -c
var fs = require('fs');
```

Using *ignore* with the `-c` or `--comment` option will comment the require statement in the bundle. Here we'll get :

```js
//@browserify-ignore -c
//var fs = require('fs');
```

*This tag is an extension of [node-ignorify](https://github.com/alexstrat/node-ignorify).*

## alias tag

```js
//@browserify-alias fs-shim
var fs = require('fs');
```

Placed in front of a require statement, the required module will be aliased with the module whose name is placed
in parameters of the tag.
Here it actually does `b.alias('fs', 'fs-shim')`.

```js
//@browserify-alias -r fs-shim
var fs = require('fs');
```

Using *alias* with the `-r` or `--replace` option will hard replace the required module with the alias module
instead of doing an alias. Here we'll get in the final bundle:

```js
//@browserify-alias -r fs-shim
var fs = require('fs-shim');
```

And *fs-shim* and its dependencies will of course be bundled instead of *fs*.

*This tag is an extension of [node-aliasify](https://github.com/alexstrat/node-aliasify).*

### Writing your own handler

A handler is a function associated to a tag and that will be called each time the parser hits the tag. A handler is in charge
to decide what to do with parameters of the tags, the source code, the bundle and so on..

I could write documentation about handler, but.. just look at how *alias* and *ignore* [handlers](https://github.com/alexstrat/node-tagify/blob/master/lib/handler)
are written.

Then, to use your handler:

```js
var myHandler = function() {
};
b.use(require('tagify').handlers({
  'mytag' : myHandler
}));
```

### Flags support

Like other pre-compilers, tagify has a kind of flags support..

*I'll talk about that later, but that looks like that :*

```js
//@browserify-alias[shim1] fs-shim1
//@browserify-alias[shim2] fs-shim2
var fs = require('fs');
```

```js
b.use(require('tagify').flags(['shim1']));
```

## Tests

*Tested with browserify ~v1.16*

[![Build Status](https://secure.travis-ci.org/alexstrat/node-tagify.png?branch=master)](https://travis-ci.org/alexstrat/node-tagify)

```bash
$ npm test
```

## Licence
MIT