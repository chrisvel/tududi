import * as React from "react";
function ArrowDownOnSquareStackIcon({
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
    d: "M7 1a.75.75 0 0 1 .75.75V6h-1.5V1.75A.75.75 0 0 1 7 1ZM6.25 6v2.94L5.03 7.72a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l2.5-2.5a.75.75 0 1 0-1.06-1.06L7.75 8.94V6H10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.25Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.268 14A2 2 0 0 0 6 15h6a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-1.732V11a3 3 0 0 1-3 3H4.268Z"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowDownOnSquareStackIcon);
export default ForwardRef;