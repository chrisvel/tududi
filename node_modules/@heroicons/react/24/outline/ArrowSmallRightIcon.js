const React = require("react");
/** @deprecated */
function ArrowSmallRightIcon({
  title,
  titleId,
  ...props
}, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeWidth: 1.5,
    stroke: "currentColor",
    "aria-hidden": "true",
    "data-slot": "icon",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: "M4.5 12h15m0 0-6.75-6.75M19.5 12l-6.75 6.75"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowSmallRightIcon);
module.exports = ForwardRef;