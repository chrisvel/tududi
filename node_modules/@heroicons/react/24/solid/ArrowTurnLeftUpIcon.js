const React = require("react");
function ArrowTurnLeftUpIcon({
  title,
  titleId,
  ...props
}, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": "true",
    "data-slot": "icon",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M20.24 20.249a.75.75 0 0 0-.75-.75H8.989V5.56l2.47 2.47a.75.75 0 0 0 1.06-1.061l-3.75-3.75a.75.75 0 0 0-1.06 0l-3.75 3.75a.75.75 0 1 0 1.06 1.06l2.47-2.469V20.25c0 .414.335.75.75.75h11.25a.75.75 0 0 0 .75-.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowTurnLeftUpIcon);
module.exports = ForwardRef;