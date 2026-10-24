/** Discord OAuth cookies are host-only. Initiate on the same host as its callback. */
export function canonicalOauthStart(requestUrl:string,appUrl:string):string|null {
 const request=new URL(requestUrl);
 const canonical=new URL(appUrl);
 if(!['https:','http:'].includes(canonical.protocol))throw Error('Invalid app origin');
 if(request.origin===canonical.origin)return null;
 return new URL('/api/auth/discord',canonical.origin).toString();
}
