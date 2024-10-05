var reg = /^\s*\/\/\s*@browserify[\s-](\w*)\s*(.*)/g;

var getMiddleware = function(handlers, flags) {

  return function(bundle) {
    bundle.register(function(body, file) {
      var src = body.split('\n');

      for(var l = 0; l < src.length; l++) {
        //test
        var split = src[l].split(reg);

        if(split[1]) {
          var command = split[1];
          var parameters = split[2].split(/\s+/g);

          //extract flags expression if any
          var flag = parameters[0].split(/\[(.*)\]/g)[1];
          if(flag) {
            //remove flag from parameters
            parameters.splice(0,1);
            
            //compute an inverse expression : '!flag'
            var inverse = false;
            if(flag.charAt(0) === '!') {
              inverse = true;
              flag = flag.substring(1);
            }

            //check if flag match
            var match = flags.indexOf(flag) !== -1;
            if((!inverse && !match) || (match && inverse)) {
              continue;
            }
          }
          
          //context for calling handler
          var context = {
            bundle  : bundle,
            line    : l,
            file    :file,
            command : command
          };

          //retrieve handler coreresponding to command
          var handler = handlers[command];

          if(handler) {
            //call it
            var returned = handler.call(null,
              parameters,
              //give source starting from line+1 after tag
              src.slice(l+1).join('\n'),
              context);

            //transform returned
            if(typeof returned === 'string')
              returned = returned.split('\n');

            //modify source according to what was returned
            if(Array.isArray(returned))
              src = src.slice(0, l+1).concat(returned);
          }
        }
      }

      return src.join('\n');
    });
  };
};

//default handlers
var handlers = {
  'ignore' : require('./handler/ignore'),
  'alias'  : require('./handler/alias')
};

module.exports = getMiddleware(handlers, []);
module.exports.flags = function(flags) {
  return getMiddleware(handlers, flags);
  };
