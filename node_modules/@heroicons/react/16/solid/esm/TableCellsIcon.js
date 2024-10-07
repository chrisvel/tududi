import * as React from "react";
function TableCellsIcon({
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
    d: "M15 11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6ZM7.25 7.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5V8a.5.5 0 0 0 .5.5h3.75a.5.5 0 0 0 .5-.5v-.5Zm1.5 3a.5.5 0 0 1 .5-.5H13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H9.25a.5.5 0 0 1-.5-.5v-.5ZM13.5 8v-.5A.5.5 0 0 0 13 7H9.25a.5.5 0 0 0-.5.5V8a.5.5 0 0 0 .5.5H13a.5.5 0 0 0 .5-.5Zm-6.75 3.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h3.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(TableCellsIcon);
export default ForwardRef;