import * as React from "react";
function ArrowTurnLeftDownIcon({
  title,
  titleId,
  ...props
}, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeWidth: 1.5,
    stroke: "currentColor",
    "aria-hidden": "true",
    "data-slot": "icon",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: "m11.99 16.5-3.75 3.75m0 0L4.49 16.5m3.75 3.75V3.75h11.25"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ArrowTurnLeftDownIcon);
export default ForwardRef;