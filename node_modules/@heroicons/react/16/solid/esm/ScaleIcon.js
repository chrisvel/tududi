import * as React from "react";
function ScaleIcon({
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
    d: "M8.75 2.5a.75.75 0 0 0-1.5 0v.508a32.661 32.661 0 0 0-4.624.434.75.75 0 0 0 .246 1.48l.13-.021-1.188 4.75a.75.75 0 0 0 .33.817A3.487 3.487 0 0 0 4 11c.68 0 1.318-.195 1.856-.532a.75.75 0 0 0 .33-.818l-1.25-5a31.31 31.31 0 0 1 2.314-.141V12.012c-.882.027-1.752.104-2.607.226a.75.75 0 0 0 .213 1.485 22.188 22.188 0 0 1 6.288 0 .75.75 0 1 0 .213-1.485 23.657 23.657 0 0 0-2.607-.226V4.509c.779.018 1.55.066 2.314.14L9.814 9.65a.75.75 0 0 0 .329.818 3.487 3.487 0 0 0 1.856.532c.68 0 1.318-.195 1.856-.532a.75.75 0 0 0 .33-.818L12.997 4.9l.13.022a.75.75 0 1 0 .247-1.48 32.66 32.66 0 0 0-4.624-.434V2.5ZM3.42 9.415a2 2 0 0 0 1.16 0L4 7.092l-.58 2.323ZM12 9.5a2 2 0 0 1-.582-.085L12 7.092l.58 2.323A2 2 0 0 1 12 9.5Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ScaleIcon);
export default ForwardRef;