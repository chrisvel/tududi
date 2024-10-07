const React = require("react");
function StopIcon({
  title,
  titleId,
  ...props
}, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 16 16",
    fill: "currentColor",
    "aria-hidden": "true",
    "data-slot": "icon",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("rect", {
    width: 10,
    height: 10,
    x: 3,
    y: 3,
    rx: 1.5
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(StopIcon);
module.exports = ForwardRef;