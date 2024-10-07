const React = require("react");
function CurrencyBangladeshiIcon({
  title,
  titleId,
  ...props
}, svgRef) {
  return /*#__PURE__*/React.createElement("svg", Object.assign({
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeWidth: 1.5,
    stroke: "currentColor",
    "aria-hidden": "true",
    "data-slot": "icon",
    ref: svgRef,
    "aria-labelledby": titleId
  }, props), title ? /*#__PURE__*/React.createElement("title", {
    id: titleId
  }, title) : null, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    d: "m8.25 7.5.415-.207a.75.75 0 0 1 1.085.67V10.5m0 0h6m-6 0h-1.5m1.5 0v5.438c0 .354.161.697.473.865a3.751 3.751 0 0 0 5.452-2.553c.083-.409-.263-.75-.68-.75h-.745M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(CurrencyBangladeshiIcon);
module.exports = ForwardRef;