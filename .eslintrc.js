module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  root: true,
  parserOptions: {
    project: ["./tsconfig.json"],
  },

  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "prefer-template": "error",
    "@typescript-eslint/no-useless-template-literals": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
  },
  ignorePatterns: ['avd/', '*.js', "run/**/*.js", ".eslintrc.js"]
};
