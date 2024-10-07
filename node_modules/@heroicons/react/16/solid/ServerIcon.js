const React = require("react");
function ServerIcon({
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
    d: "M3.665 3.588A2 2 0 0 1 5.622 2h4.754a2 2 0 0 1 1.958 1.588l1.098 5.218a3.487 3.487 0 0 0-1.433-.306H4c-.51 0-.995.11-1.433.306l1.099-5.218Z"
  }), /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M4 10a2 2 0 1 0 0 4h8a2 2 0 1 0 0-4H4Zm8 2.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM9.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z",
    clipRule: "evenodd"
  }));
}
const ForwardRef = /*#__PURE__*/ React.forwardRef(ServerIcon);
module.exports = ForwardRef;