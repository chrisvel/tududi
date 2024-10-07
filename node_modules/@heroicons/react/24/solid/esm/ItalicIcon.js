import * as React from "react";
function ItalicIcon({
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
    d: "M10.497 3.744a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-3.275l-5.357 15.002h2.632a.75.75 0 1 1 0 1.5h-7.5a.75.75 0 1 1 0-1.5h3.275l5.357-15.002h-2.632a.75.75 0 0 1-.75-.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ItalicIcon);
export default ForwardRef;