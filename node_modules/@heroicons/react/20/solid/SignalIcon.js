const React = require("react");
function SignalIcon({
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
    d: "M16.364 3.636a.75.75 0 0 0-1.06 1.06 7.5 7.5 0 0 1 0 10.607.75.75 0 0 0 1.06 1.061 9 9 0 0 0 0-12.728ZM4.697 4.697a.75.75 0 0 0-1.061-1.061 9 9 0 0 0 0 12.728.75.75 0 1 0 1.06-1.06 7.5 7.5 0 0 1 0-10.607Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12.475 6.464a.75.75 0 0 1 1.06 0 5 5 0 0 1 0 7.072.75.75 0 0 1-1.06-1.061 3.5 3.5 0 0 0 0-4.95.75.75 0 0 1 0-1.06ZM7.525 6.464a.75.75 0 0 1 0 1.061 3.5 3.5 0 0 0 0 4.95.75.75 0 0 1-1.06 1.06 5 5 0 0 1 0-7.07.75.75 0 0 1 1.06 0ZM11 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(SignalIcon);
module.exports = ForwardRef;