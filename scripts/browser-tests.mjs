import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

if (!existsSync(resolve('.next/BUILD_ID'))) {
  console.error('Exécutez npm.cmd run build avant les tests navigateur.');
  process.exit(1);
}
// Each run owns a new disposable database. Never reset or recycle the user's collection.
const databasePath=resolve('data',`test-browser-${randomUUID()}.sqlite`);
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{
  stdio:'inherit',env:{...process.env,FREDOU_E2E_DATABASE_PATH:databasePath}
});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('close',code=>{
  // Playwright has stopped its owned server before the CLI exits.
  for(const suffix of ['', '-wal', '-shm']) {
    try { rmSync(databasePath+suffix,{force:true}); }
    catch(error) { console.warn(`Base de test à nettoyer après fermeture du serveur : ${databasePath+suffix}`,error.code); }
  }
  process.exitCode=code??1;
});
