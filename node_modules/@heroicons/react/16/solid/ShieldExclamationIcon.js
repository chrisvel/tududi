const React = require("react");
function ShieldExclamationIcon({
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
    d: "M7.5 1.709a.75.75 0 0 1 1 0 8.963 8.963 0 0 0 4.84 2.217.75.75 0 0 1 .654.72 10.499 10.499 0 0 1-5.647 9.672.75.75 0 0 1-.694-.001 10.499 10.499 0 0 1-5.647-9.672.75.75 0 0 1 .654-.719A8.963 8.963 0 0 0 7.5 1.71ZM8 5a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2A.75.75 0 0 1 8 5Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ShieldExclamationIcon);
module.exports = ForwardRef;