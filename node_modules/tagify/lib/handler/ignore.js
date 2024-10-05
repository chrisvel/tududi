var optimist = require('optimist');
var findNextRequire = require('./helper/findnextrequire');

module.exports = function(parameters, src, context) {
  parameters = optimist(parameters)
               .option('comment', {
                 default : false,
                 boolean : true,
                 alias : 'c'
               })
               .argv;

  nextReq = findNextRequire(src);

  if(nextReq !== null) {

    if(parameters.comment) {
    //source commenting ignore
      var lines = src.split('\n');
      var line = lines[nextReq.line];

      //comment elegament the line
      line = line.replace(/^(\s*)/g, '$1//');

      lines.splice(nextReq.line, 1, line);
      src = lines.join('\n');
      return src;

    } else {
    //traditional ignore
      context.bundle.ignore(nextReq.module);
    }
  }
};