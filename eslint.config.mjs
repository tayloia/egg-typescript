// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "_$",
        }
      ]
    }
  },
  {
    files: ["**/*.tests.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off"
    }
  },
);
