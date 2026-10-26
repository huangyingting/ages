import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
// WebGL in CI/containers: run under Xvfb (xvfb-run) with SwiftShader.
const gl = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  // shared CI runners render WebGL in software: one retry absorbs timing hiccups there
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: !process.env.DISPLAY,
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    // the offline service worker would answer requests before page.route mocks; the offline test opts back in
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { args: gl } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { args: gl } }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
