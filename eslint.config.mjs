// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-namespace": "off"
    }
  },
  {
    files: ["**/*.tests.ts"],
    rules: {
        "@typescript-eslint/no-unused-expressions": "off"
    }
  },
);
