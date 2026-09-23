import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const packagePath=require.resolve('@netlify/blobs/package.json');
const {version}=JSON.parse(await readFile(packagePath,'utf8'));
if(version!=='11.0.3')throw Error(`Expected @netlify/blobs 11.0.3, found ${version}`);

const bundlePath=packagePath.replace(/package\.json$/,'dist/chunk-6TDSNTDP.js');
const source=await readFile(bundlePath,'utf8');
const retryMarker='attemptsLeft = options.method === "get" || options.method === "head" || options.method === "put" && options.headers["if-match"] ? MAX_RETRY : 0';
const retry429Marker='if (error?.upstreamStatus === 429 || attemptsLeft === 0)';
if(source.includes(retryMarker)&&source.includes(retry429Marker)&&source.includes('const isRetryable = res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;'))process.exit(0);

const replacements=[
 ['var DEFAULT_RETRY_DELAY = getEnvironment2().get("NODE_ENV") === "test" ? 1 : 5e3;','var DEFAULT_RETRY_DELAY = 300;'],
 ['var MIN_RETRY_DELAY = 1e3;','var MIN_RETRY_DELAY = 300;'],
 ['var MAX_RETRY = 5;','var MAX_RETRY = 1;'],
 ['var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY, getRetryUrl) => {',`var fetchAndRetry = async (fetch, url, options, ${retryMarker}, getRetryUrl) => {`],
 ['const isRetryable = res.status === 429 || res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;','const isRetryable = res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;'],
 ['const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));','const delay = Math.min(300, getDelay(res.headers.get(RATE_LIMIT_HEADER)));'],
 ['if (attemptsLeft === 0) {','if (error?.upstreamStatus === 429 || attemptsLeft === 0) {']
];
for(const [before] of replacements)if(!source.includes(before))throw Error('Netlify Blobs retry code did not match expected 11.0.3 bundle');
let patched=source;
for(const [before,after] of replacements)patched=patched.replace(before,after);
await writeFile(bundlePath,patched);
