import { executeAction } from '../../src/server/engine';
import type { Action } from '../../src/lib/contracts';
const [userId,payload,key]=process.argv.slice(2);
try {
  const result=executeAction(userId,JSON.parse(payload) as Action,key);
  process.stdout.write(JSON.stringify({ok:true,result}));
} catch(error) {
  process.stdout.write(JSON.stringify({ok:false,code:error instanceof Error && 'code' in error?error.code:'UNKNOWN'}));
}
