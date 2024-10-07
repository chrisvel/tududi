const React = require("react");
function NewspaperIcon({
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
    d: "M10 3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v9a2 2 0 0 0 2 2h8a2 2 0 0 1-2-2V3ZM4 4h4v2H4V4Zm4 3.5H4V9h4V7.5Zm-4 3h4V12H4v-1.5Z",
    clipRule: "evenodd"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13 5h-1.5v6.25a1.25 1.25 0 1 0 2.5 0V6a1 1 0 0 0-1-1Z"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(NewspaperIcon);
module.exports = ForwardRef;