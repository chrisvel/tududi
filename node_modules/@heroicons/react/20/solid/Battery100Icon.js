const React = require("react");
function Battery100Icon({
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
    d: "M4.75 8a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h9.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75h-9.5Z"
  }), /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M1 7.25A2.25 2.25 0 0 1 3.25 5h12.5A2.25 2.25 0 0 1 18 7.25v1.085a1.5 1.5 0 0 1 1 1.415v.5a1.5 1.5 0 0 1-1 1.415v1.085A2.25 2.25 0 0 1 15.75 15H3.25A2.25 2.25 0 0 1 1 12.75v-5.5Zm2.25-.75a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h12.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75H3.25Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(Battery100Icon);
module.exports = ForwardRef;