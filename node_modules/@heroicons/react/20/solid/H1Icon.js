const React = require("react");
function H1Icon({
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
    d: "M2.75 4a.75.75 0 0 1 .75.75v4.5h5v-4.5a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0v-4.5h-5v4.5a.75.75 0 0 1-1.5 0V4.75A.75.75 0 0 1 2.75 4ZM13 8.75a.75.75 0 0 1 .75-.75h1.75a.75.75 0 0 1 .75.75v5.75h1a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5h1v-5h-1a.75.75 0 0 1-.75-.75Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(H1Icon);
module.exports = ForwardRef;