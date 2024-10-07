import * as React from "react";
/** @deprecated */
function ArrowSmallLeftIcon({
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
    d: "M15 10a.75.75 0 0 1-.75.75H7.612l2.158 1.96a.75.75 0 1 1-1.04 1.08l-3.5-3.25a.75.75 0 0 1 0-1.08l3.5-3.25a.75.75 0 1 1 1.04 1.08L7.612 9.25h6.638A.75.75 0 0 1 15 10Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowSmallLeftIcon);
export default ForwardRef;