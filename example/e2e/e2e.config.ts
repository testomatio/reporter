import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import testomatio from '../../src/adapter/e2e.js';

export default {
  targets: [
    {
      engine: web(),
      app: {
        url: 'http://127.0.0.1:0',
        command: { executable: 'node', args: ['server.js'], env: { PORT: '{port}' } },
      },
    },
  ],
  reporters: ['list', testomatio()],
} satisfies E2EConfig;
