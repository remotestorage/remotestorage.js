var options = {
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  env: {
    browser: true,
    node: true,
    es6: true
  }, globals: {
    "ArrayBuffer": true,
    "ArrayBufferView": true
  },
  extends: "eslint:recommended",
  rules: {
    "complexity": ["warn"],
    "max-statements": ["warn"],
    "no-debugger": 2,
    "no-console": [
      2,
      {
        allow: ["warn", "error"]
      }
    ],
    "no-bitwise": 2,
    "curly": 2,
    "eqeqeq": 2,
    "no-eval": 2,
    // "no-use-before-define": 2,
    "no-loop-func": 0,
    "no-caller": 2,
    "no-script-url": 2,
    "no-shadow": 2,
    "no-new-func": 0,
    "no-new-wrappers": 0,
    "no-undef": 2,
    "new-cap": [
      "error", {
        "capIsNewExceptions": [ "Authorize", "Discover" ]
      }
    ],
    "no-empty": 2,
    "no-new": 2,
    "no-useless-escape": 0,
    "block-spacing": 2,
    "indent": [
      "error",
      2,
      {
        "SwitchCase": 1,
        "VariableDeclarator": 2,
        "MemberExpression": "off",
        "CallExpression": {
          arguments: "off"
        }
      }
    ],
    "no-multi-str": 2,
    "semi": 2,
    "arrow-spacing": 2
  }
};

module.exports = options;
