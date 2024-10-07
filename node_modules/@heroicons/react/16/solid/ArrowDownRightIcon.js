const React = require("react");
function ArrowDownRightIcon({
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
    d: "M4.22 4.22a.75.75 0 0 0 0 1.06l5.22 5.22H5.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-1.5 0v3.69L5.28 4.22a.75.75 0 0 0-1.06 0Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowDownRightIcon);
module.exports = ForwardRef;