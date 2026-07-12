import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// NestJS dekoratorlari (@Injectable, @Controller...) DI uchun reflect-metadata'ga
// tayanadi — esbuild (vitest default'i) emitDecoratorMetadata'ni to'liq qo'llamaydi,
// shuning uchun SWC transform ishlatiladi (https://docs.nestjs.com/recipes/swc#vitest).
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    testTimeout: 15000,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
});
