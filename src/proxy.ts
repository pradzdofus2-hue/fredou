import {NextRequest,NextResponse} from 'next/server';

// Temporary release lock: all write APIs and gameplay are unavailable during maintenance.
export function proxy(request:NextRequest) {
 const path=request.nextUrl.pathname;
 if(path.startsWith('/_next/')||path.startsWith('/branding/')||path==='/favicon.svg')return NextResponse.next();
 if(path.startsWith('/api/'))return NextResponse.json({error:{code:'MAINTENANCE',message:'Krosmoria est temporairement en maintenance.'}},{status:503,headers:{'Retry-After':'600','Cache-Control':'no-store'}});
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Krosmoria — Maintenance</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 25%,#243657,#0a0f21 70%);font-family:system-ui,sans-serif;color:#f8f2dc;text-align:center;padding:24px}main{max-width:620px}img{width:min(78vw,380px);height:auto;filter:drop-shadow(0 12px 30px #0008)}h1{font-size:clamp(30px,5vw,48px);margin:34px 0 12px}p{color:#c7d4e7;font-size:clamp(16px,2.7vw,21px);line-height:1.6}.spark{color:#e3bd6a;font-size:24px}</style></head><body><main><img src="/branding/krosmoria-logo.svg" alt="Krosmoria"><div class="spark">✦ ✧ ✦</div><h1>Le monde est en maintenance</h1><p>Nous préparons de nouvelles surprises pour vos collections !<br>Le site revient très vite. Merci pour votre patience 💛</p></main></body></html>`;
 return new NextResponse(html,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'600'}});
}
export const config={matcher:['/((?!_next/static|_next/image).*)']};
