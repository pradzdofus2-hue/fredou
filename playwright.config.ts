import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const temporary=resolve('.cache/playwright-temp');
mkdirSync(temporary,{recursive:true});
process.env.TEMP=temporary;process.env.TMP=temporary;process.env.TMPDIR=temporary;
export default defineConfig({
  testDir:'./tests',testMatch:'browser.spec.ts',fullyParallel:false,workers:1,
  timeout:45_000,expect:{timeout:12_000},retries:0,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://localhost:3100',channel:'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'off'},
  webServer:{
    command:'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url:'http://localhost:3100/api/state',reuseExistingServer:false,timeout:60_000,
    env:{APP_URL:'http://localhost:3100',LOCAL_DEV_MODE:'true',DATABASE_PATH:process.env.FREDOU_E2E_DATABASE_PATH || resolve(`data/test-browser-${process.pid}.sqlite`)}
  }
});
