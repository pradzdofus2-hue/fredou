import {NextResponse} from 'next/server';
export function proxy(request:Request){const p=new URL(request.url).pathname;if(p.startsWith('/_next/')||p.startsWith('/branding/'))return NextResponse.next();return new NextResponse('<h1>Krosmoria en maintenance</h1>',{status:503,headers:{'Content-Type':'text/html'}})}
