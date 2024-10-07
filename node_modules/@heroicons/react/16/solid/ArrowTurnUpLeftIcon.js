const React = require("react");
function ArrowTurnUpLeftIcon({
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
    d: "M13.25 14a.75.75 0 0 1-.75-.75v-6.5H4.56l.97.97a.75.75 0 0 1-1.06 1.06L2.22 6.53a.75.75 0 0 1 0-1.06l2.25-2.25a.75.75 0 0 1 1.06 1.06l-.97.97h8.69A.75.75 0 0 1 14 6v7.25a.75.75 0 0 1-.75.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowTurnUpLeftIcon);
module.exports = ForwardRef;