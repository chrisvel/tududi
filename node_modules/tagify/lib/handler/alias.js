var optimist = require('optimist');
var findNextRequire = require('./helper/findnextrequire');

module.exports = function(parameters, src, context) {
  parameters = optimist(parameters)
               .option('replace', {
                 default : false,
                 boolean : true,
                 alias : 'r'
               })
               .argv;

  nextReq = findNextRequire(src);

  if(nextReq !== null) {
    var alias = parameters._[0];

    if(parameters.replace) {
      var lines = src.split('\n');
      var line = nextReq.match[1]+alias+nextReq.match[3];
      lines.splice(nextReq.line, 1, line);

      src = lines.join('\n');
      return src;
      
    } else {
      context.bundle.alias(nextReq.module, alias);
    }
  }
};