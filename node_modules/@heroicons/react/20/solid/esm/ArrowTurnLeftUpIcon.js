import * as React from "react";
function ArrowTurnLeftUpIcon({
  title,
  titleId,
  ...props
}, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": "true",
    "data-slot": "icon",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M16 16.25a.75.75 0 0 0-.75-.75h-7.5V4.56l1.97 1.97a.75.75 0 1 0 1.06-1.06L7.53 2.22a.75.75 0 0 0-1.06 0L3.22 5.47a.75.75 0 0 0 1.06 1.06l1.97-1.97v11.69c0 .414.336.75.75.75h8.25a.75.75 0 0 0 .75-.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowTurnLeftUpIcon);
export default ForwardRef;