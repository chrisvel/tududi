import * as React from "react";
function CurrencyBangladeshiIcon({
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
    d: "M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM5.25 4.707a.75.75 0 0 1-.78-1.237c.841-.842 2.28-.246 2.28.944V6h5.5a.75.75 0 0 1 0 1.5h-5.5v3.098c0 .549.295.836.545.87a3.241 3.241 0 0 0 2.799-.966H9.75a.75.75 0 0 1 0-1.5h1.708a.75.75 0 0 1 .695 1.032 4.751 4.751 0 0 1-5.066 2.92c-1.266-.177-1.837-1.376-1.837-2.356V7.5h-1.5a.75.75 0 0 1 0-1.5h1.5V4.707Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(CurrencyBangladeshiIcon);
export default ForwardRef;