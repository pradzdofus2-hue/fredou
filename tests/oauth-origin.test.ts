import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalOauthStart} from '../src/server/oauth-origin';

test('OAuth starts on configured stable Vercel alias instead of unique deployment URL',()=>{
 const alias='https://fredouu-git-feature-dofus-catalogue-pradzdofus2-hues-projects.vercel.app';
 assert.equal(canonicalOauthStart('https://fredouu-8zohouf9u-pradzdofus2-hues-projects.vercel.app/api/auth/discord',alias),
 alias+'/api/auth/discord');
});
test('OAuth avoids redirects once already on canonical host',()=>{
 assert.equal(canonicalOauthStart('https://fredouu.vercel.app/api/auth/discord','https://fredouu.vercel.app'),null);
});
test('OAuth ignores untrusted original path or query parameters',()=>{
 const canonical=canonicalOauthStart('https://other.example/api/auth/discord?return=https://evil.example','https://fredouu.vercel.app');
 assert.equal(canonical,'https://fredouu.vercel.app/api/auth/discord');
});
