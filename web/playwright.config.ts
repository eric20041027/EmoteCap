import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',workers:1,timeout:30000,expect:{timeout:5000},forbidOnly:!!process.env.CI,
  outputDir:'../.superpowers/sdd/2026-10-07-studio-integration/browser-results',
  reporter:[['list'],['html',{outputFolder:'../.superpowers/sdd/2026-10-07-studio-integration/browser-report',open:'never'}]],
  use:{browserName:'chromium',channel:process.env.EMOTECAP_BROWSER_CHANNEL||undefined,
    baseURL:'http://127.0.0.1:4175',viewport:{width:1280,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort --force',
    url:'http://127.0.0.1:4175',reuseExistingServer:false,timeout:15000,stdout:'ignore',stderr:'pipe'},
});
