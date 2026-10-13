'use strict';

// A blog made of public notes. The superadmin picks a note as the front
// page; the public notes it links with [[Title]] are the posts. Readable at
// /blog in the app and, on the hostnames in TUDUDI_BLOG_HOSTS, at the root.

const routes = require('./routes');
const blogService = require('./service');
const { hostSwitch } = require('./hostSwitch');

module.exports = { routes, blogService, hostSwitch };
