/**
 * @take/ui - vitest.config.ts
 * 工单 17 真实 DOM 交互测试配置文件
 * 引入 happy-dom 提供标准真实 DOM 环境（document, window, Element, replaceChild, Event）
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
