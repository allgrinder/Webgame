import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  // Software-Rendering im Container: Tests nacheinander, damit die Simulation in Echtzeit läuft
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
