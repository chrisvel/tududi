import * as React from "react";
function ServerStackIcon({
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
    d: "M5.354 2a2 2 0 0 0-1.857 1.257l-.338.845C3.43 4.035 3.71 4 4 4h8c.29 0 .571.035.84.102l-.337-.845A2 2 0 0 0 10.646 2H5.354Z"
  }), /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M2 13a2 2 0 0 1 2-2h8a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2Zm10.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9 13.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM4 5.5a2 2 0 1 0 0 4h8a2 2 0 1 0 0-4H4Zm8 2.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM9.75 7.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ServerStackIcon);
export default ForwardRef;