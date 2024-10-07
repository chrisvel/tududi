import * as React from "react";
function MusicalNoteIcon({
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
    d: "M17.721 1.599a.75.75 0 0 1 .279.583v11.29a2.25 2.25 0 0 1-1.774 2.2l-2.041.44a2.216 2.216 0 0 1-.938-4.332l2.662-.577a.75.75 0 0 0 .591-.733V6.112l-8 1.73v7.684a2.25 2.25 0 0 1-1.774 2.2l-2.042.44a2.216 2.216 0 1 1-.935-4.331l2.659-.573A.75.75 0 0 0 7 12.529V4.236a.75.75 0 0 1 .591-.733l9.5-2.054a.75.75 0 0 1 .63.15Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(MusicalNoteIcon);
export default ForwardRef;