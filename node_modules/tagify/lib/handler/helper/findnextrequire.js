var require_reg = /(.*require\(['"])(.*)(['"]\).*)/g;

module.exports = function(src) {

  var lines = src.split('\n');

  //ignore empty or commented lines
  var l=0;
  while(lines[l].match(/^\s*\/\/.*/g)||lines[l].match(/^\s*$/g)) {
    l++;
  }
  var match = lines[l].split(require_reg);

  if(!match[1])
    return null;

  return {
    line   : l, // line number of require
    module : match[2], //require argument
    match  : match // result of exec
  };
};