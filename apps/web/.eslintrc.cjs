module.exports = {
  extends: ['@dexera/eslint-config/next'],
  overrides: [
    {
      files: ['next-env.d.ts'],
      rules: {
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
  ],
};
