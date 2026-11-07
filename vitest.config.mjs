// JS のテスト（npm test）。DOM は happy-dom で用意する
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/js/**/*.test.mjs'],
    environment: 'happy-dom',
  },
});
