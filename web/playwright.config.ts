import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const artifacts=process.env.EMOTECAP_E2E_ARTIFACT_DIR||`../.superpowers/e2e/${randomUUID()}`;
export default defineConfig({
  testDir:'./e2e',workers:1,timeout:30000,expect:{timeout:5000},forbidOnly:!!process.env.CI,
  outputDir:`${artifacts}/results`,
  reporter:[['list'],['html',{outputFolder:`${artifacts}/report`,open:'never'}]],
  projects:[{name:'studio-development',testIgnore:'production.spec.ts'},
    {name:'studio-production',testMatch:'production.spec.ts',use:{baseURL:'http://127.0.0.1:4176'}}],
  use:{browserName:'chromium',channel:process.env.EMOTECAP_BROWSER_CHANNEL||undefined,
    baseURL:'http://127.0.0.1:4175',viewport:{width:1280,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:[{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort --force',
    url:'http://127.0.0.1:4175',reuseExistingServer:false,timeout:15000,stdout:'ignore',stderr:'pipe'},
    {command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4176 --strictPort',
    url:'http://127.0.0.1:4176',reuseExistingServer:false,timeout:15000,stdout:'ignore',stderr:'pipe'}],
});
