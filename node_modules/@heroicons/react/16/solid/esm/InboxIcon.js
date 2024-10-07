import * as React from "react";
function InboxIcon({
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
    d: "M4.784 3A2.25 2.25 0 0 0 2.68 4.449L1.147 8.475A2.25 2.25 0 0 0 1 9.276v1.474A2.25 2.25 0 0 0 3.25 13h9.5A2.25 2.25 0 0 0 15 10.75V9.276c0-.274-.05-.545-.147-.801l-1.534-4.026A2.25 2.25 0 0 0 11.216 3H4.784Zm-.701 1.983a.75.75 0 0 1 .7-.483h6.433a.75.75 0 0 1 .701.483L13.447 9h-2.412a1 1 0 0 0-.832.445l-.406.61a1 1 0 0 1-.832.445h-1.93a1 1 0 0 1-.832-.445l-.406-.61A1 1 0 0 0 4.965 9H2.553l1.53-4.017Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(InboxIcon);
export default ForwardRef;