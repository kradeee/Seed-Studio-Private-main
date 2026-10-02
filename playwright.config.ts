import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',
 timeout:45000,
 expect:{timeout:10000},
 fullyParallel:false,
 workers:1,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 reporter:'list',
 use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}],
 webServer:{
  command:'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
  url:'http://127.0.0.1:5173',
  reuseExistingServer:!process.env.CI,
  timeout:60000,
 },
});
