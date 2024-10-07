import * as React from "react";
function ChevronDoubleUpIcon({
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
    d: "M7.47 3.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1-1.06 1.06L8 4.81 5.28 7.53a.75.75 0 0 1-1.06-1.06l3.25-3.25Zm-3.25 8.25 3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 1 1-1.06 1.06L8 9.81l-2.72 2.72a.75.75 0 0 1-1.06-1.06Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ChevronDoubleUpIcon);
export default ForwardRef;