const React = require("react");
function DivideIcon({
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
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Z",
    clipRule: "evenodd"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(DivideIcon);
module.exports = ForwardRef;