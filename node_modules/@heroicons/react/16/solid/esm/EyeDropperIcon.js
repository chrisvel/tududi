import * as React from "react";
function EyeDropperIcon({
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
    d: "M15 4a3.001 3.001 0 0 1-2.25 2.905V8.5a.75.75 0 0 1-.22.53l-.5.5a.75.75 0 0 1-1.06 0l-.72-.72-4.677 4.678A1.75 1.75 0 0 1 4.336 14h-.672a.25.25 0 0 0-.177.073l-.707.707a.75.75 0 0 1-1.06 0l-.5-.5a.75.75 0 0 1 0-1.06l.707-.707A.25.25 0 0 0 2 12.336v-.672c0-.464.184-.909.513-1.237L7.189 5.75l-.72-.72a.75.75 0 0 1 0-1.06l.5-.5a.75.75 0 0 1 .531-.22h1.595A3.001 3.001 0 0 1 15 4ZM9.19 7.75l-.94-.94-4.677 4.678a.25.25 0 0 0-.073.176v.672c0 .058-.003.115-.009.173a1.74 1.74 0 0 1 .173-.009h.672a.25.25 0 0 0 .177-.073L9.189 7.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(EyeDropperIcon);
export default ForwardRef;