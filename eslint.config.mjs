import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
// LTD-PATCH(T-302): local rule, no new dependency
import ltdNoPhysicalClasses from "./eslint-rules/ltd-no-physical-classes.mjs";


export default [
  {files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"]},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/prop-types": "off"
    },
    settings: {
      react: {
        version: "18"
      }
    }
  },
  {
    // LTD-PATCH(T-302): logical-direction classes only in components
    files: ["frontend/components/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      ltd: {
        rules: {
          "no-physical-classes": ltdNoPhysicalClasses
        }
      }
    },
    rules: {
      "ltd/no-physical-classes": "error"
    }
  }
];
