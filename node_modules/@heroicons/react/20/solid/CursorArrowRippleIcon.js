const React = require("react");
function CursorArrowRippleIcon({
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
    d: "M6.111 11.89A5.5 5.5 0 1 1 15.501 8 .75.75 0 0 0 17 8a7 7 0 1 0-11.95 4.95.75.75 0 0 0 1.06-1.06Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.232 6.232a2.5 2.5 0 0 0 0 3.536.75.75 0 1 1-1.06 1.06A4 4 0 1 1 14 8a.75.75 0 0 1-1.5 0 2.5 2.5 0 0 0-4.268-1.768Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.766 7.51a.75.75 0 0 0-1.37.365l-.492 6.861a.75.75 0 0 0 1.204.65l1.043-.799.985 3.678a.75.75 0 0 0 1.45-.388l-.978-3.646 1.292.204a.75.75 0 0 0 .74-1.16l-3.874-5.764Z"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(CursorArrowRippleIcon);
module.exports = ForwardRef;