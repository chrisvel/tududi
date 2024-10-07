import * as React from "react";
function H1Icon({
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
    d: "M1.75 3a.75.75 0 0 1 .75.75v3.5h4v-3.5a.75.75 0 0 1 1.5 0v8.5a.75.75 0 0 1-1.5 0v-3.5h-4v3.5a.75.75 0 0 1-1.5 0v-8.5A.75.75 0 0 1 1.75 3ZM10 6.75a.75.75 0 0 1 .75-.75h1.75a.75.75 0 0 1 .75.75v4.75h1a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5h1v-4h-1a.75.75 0 0 1-.75-.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(H1Icon);
export default ForwardRef;