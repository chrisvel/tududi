const React = require("react");
function BoldIcon({
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
    d: "M3 3a1 1 0 0 1 1-1h5a3.5 3.5 0 0 1 2.843 5.541A3.75 3.75 0 0 1 9.25 14H4a1 1 0 0 1-1-1V3Zm2.5 3.5v-2H9a1 1 0 0 1 0 2H5.5Zm0 2.5v2.5h3.75a1.25 1.25 0 1 0 0-2.5H5.5Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(BoldIcon);
module.exports = ForwardRef;