// Builds /filmmaand/wanneer/ (the date poll as a group chat) from the approved invitation kit, so the design is not forked.
//
//   node scripts/build-wanneer.mjs [path/to/kits/invitations/05-calendly-study/jasjes2]
//   (or FILMMAAND_INVITE_KIT=<that dir>; default: /home/chris/filmmaand-integration/kits/invitations/05-calendly-study/jasjes2)
//
// Source of truth for the look is the kit: appje.css + appje2.css + the markup in build-appje2.py (Cameo), and
// eggs/eggs.{css,js} (Capsule). This script reads the kit's BUILT appje2.html (what Chris approved), refuses to run if that
// file is stale against those sources, and then:
//   - keeps the page CSS and markup byte-for-byte, except: the inlined mascot becomes a hashed asset file, the sample member
//     names in the header become "Alec, jij" (filled in from the API at runtime), the own-avatar image becomes a blank
//     placeholder (filled in at runtime), and one empty system chip (#note) is added for connection messages, plus the post-pick RSVP block (#rsvp);
//   - drops the kit's script (sample CREW fixture, localStorage state, appje2.js) and loads wanneer.js instead;
//   - copies eggs.js verbatim (plus a generated-from header) so wanneer.js can start it once the real vote state is known.
// Outputs (commit them; Netlify cannot see the kit):
//   public/filmmaand/wanneer/index.html      GENERATED
//   public/filmmaand/wanneer/eggs.js         GENERATED
//   public/filmmaand/wanneer/games.js        GENERATED (the chat games, eggs/games.{js,css}; its css is inlined in index.html)
//   public/filmmaand/assets/wanneer-pudding-<sha8>.png
// Hand-written, never touched here: public/filmmaand/wanneer/wanneer.js (ported from appje2.js; the builder fails when
// the kit's appje2.js changed since the port, so a behaviour change in the kit is never silently left behind).
import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const kit=(process.argv[2]||process.env.FILMMAAND_INVITE_KIT||'/home/chris/filmmaand-integration/kits/invitations/05-calendly-study/jasjes2').replace(/\/$/,'');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{console.error('build-wanneer: '+m);process.exit(1)};
const read=async p=>{try{return await readFile(p,'utf8')}catch{fail('cannot read '+p+' (pass the kit directory as the first argument)')}};

const built=await read(kit+'/appje2.html');
const appjeJs=await read(kit+'/appje2.js'),eggsCss=await read(kit+'/eggs/eggs.css'),eggsJs=await read(kit+'/eggs/eggs.js');
// The chat games (Capsule, 23 Sept): a separate kit file, loaded as its own script right after wanneer.js (before eggs.js starts),
// so eggs.js can render game cards through window.filmmaandGames.makeCard.
const gamesJs=await read(kit+'/eggs/games.js'),gamesCss=await read(kit+'/eggs/games.css');

// 1. The built page must be current: its embedded page script and eggs are exactly today's sources.
for(const [name,src] of [['appje2.js',appjeJs],['eggs/eggs.css',eggsCss],['eggs/eggs.js',eggsJs]])
 if(!built.includes(src))fail('appje2.html is stale against '+name+': run `python3 build-appje2.py` in the kit first.');

// 2. wanneer.js must have been ported from this appje2.js.
const wanneerPath=root+'public/filmmaand/wanneer/wanneer.js',wanneer=await read(wanneerPath);
const portedFrom=/ported from appje2\.js sha256:([0-9a-f]{64})/.exec(wanneer)?.[1];
if(portedFrom!==sha(appjeJs))fail('the kit\'s appje2.js changed since wanneer.js was ported (sha256 '+sha(appjeJs)+').\n'+
 'Carry the behaviour change into public/filmmaand/wanneer/wanneer.js by hand, then update its "ported from" line.');

// 3. Split the built page: <style>page css</style> markup <script>fixture+appje2.js</script><style>eggs</style><script>eggs</script>
const cssStart=built.indexOf('<style>'),cssEnd=built.indexOf('</style>');
const scriptStart=built.indexOf('<script>const AV=');
if(cssStart<0||cssEnd<cssStart||scriptStart<cssEnd)fail('unexpected appje2.html shape');
const css=built.slice(cssStart+7,cssEnd);
let markup=built.slice(cssEnd+8,scriptStart);

// Sample people from the kit's fixture: collected here so we can prove none of them ship.
const crew=/const CREW=\[([\s\S]*?)\];/.exec(built.slice(scriptStart))?.[1]||'';
const fixtureNames=[...crew.matchAll(/\{n:'([^']+)'/g)].map(m=>m[1]);
if(fixtureNames.length<3)fail('could not find the CREW fixture names in appje2.html');

// 4. Mascot → asset file. The own avatar → blank placeholder (wanneer.js fills it).
const images=[...markup.matchAll(/src="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/g)].map(m=>m[1]);
const meImg=/<a class="me"[^>]*><img src="(data:[^"]+)"/.exec(markup)?.[1];
if(!meImg)fail('own-avatar image not found');
const cat=[...new Set(images.filter(s=>s!==meImg))];
if(cat.length!==1)fail('expected exactly one mascot image, found '+cat.length);
const catBytes=Buffer.from(cat[0].split(',')[1],'base64'),catName='wanneer-pudding-'+sha(catBytes).slice(0,8)+'.png';
const BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
markup=markup.split(cat[0]).join('/filmmaand/assets/'+catName).replace(meImg,BLANK);

// 5. Header members: sample names out, real names come from the API.
const sub=/<span id="sub">[^<]*<\/span>/;
if(!sub.test(markup))fail('#sub not found');
markup=markup.replace(sub,'<span id="sub">Alec, jij</span>');

// 6. One calm system chip for connection/link messages, right after the existing #sys chip (same .sys style).
const sysChip='<p class="sys" id="sys" hidden>';
if(!markup.includes(sysChip))fail('#sys not found');
markup=markup.replace(/(<p class="sys" id="sys" hidden>[^<]*<\/p>)/,'$1<p class="sys" id="note" role="status" hidden></p>');
// 7. After a pick: "Ben je erbij?" with the kit's own poll pieces (.wrapx/.ask/.quick/.sub), styled later by Cameo/Capsule.
markup=markup.replace('<p class="sys" id="note" role="status" hidden></p>','<p class="sys" id="note" role="status" hidden></p>'+
 '<div class="wrapx" id="rsvp" hidden><p class="ask">Ben je erbij?</p><div class="quick"><button id="rsvp-ja" aria-pressed="false">Ja, ik kom!</button>'+
 '<button id="rsvp-nee" aria-pressed="false">Toch niet</button></div><p class="sub" id="rsvp-sub"></p></div>');

// Page-only CSS (Cameo, design owner, 23 Sept): the RSVP button the confirmation mail pre-selected, until it is tapped.
// The kit hides .quick/.sub once you voted (the results view); the RSVP block reuses those pieces and must stay visible.
const PAGE_CSS='body.voted #rsvp .quick{display:flex}body.voted #rsvp .sub{display:block}'+
 '#rsvp button[data-pre=true]:not([aria-pressed=true]){border:1.5px dashed #00a884;background:#f0fbf7}'+
 '@media (prefers-color-scheme:dark){#rsvp button[data-pre=true]:not([aria-pressed=true]){background:#103529}}';
// The intro film (Cairn, approved by Chris 23 Sept): kit film/film.bundle.js + film/film-loader.js, served next to the page.
// FILM_MODE (read by Cairn's loader): 'force-only' = only ?film plays it (for Chris's real-phone test); 'off'; 'first-visit' = as designed (first visit only, never under reduced motion, stands down if the visitor already tapped/typed). Flip in a commit.
const FILM_MODE='force-only';
const filmBundle=await readFile(kit+'/film/film.bundle.js','utf8'),filmLoaderSrc=await readFile(kit+'/film/film-loader.js','utf8');
if(!filmLoaderSrc.includes('AFM_FILM_MODE'))fail('film-loader.js: expected the AFM_FILM_MODE switch (Cairn)');
const filmLoader='// GENERATED by scripts/build-wanneer.mjs from the kit\'s film/film-loader.js (Cairn), sha256:'+sha(filmLoaderSrc)+'\n'+filmLoaderSrc;
const filmOut='// GENERATED by scripts/build-wanneer.mjs: verbatim copy of the kit\'s film/film.bundle.js (Cairn), sha256:'+sha(filmBundle)+'\n'+filmBundle;
const head='<!-- GENERATED by scripts/build-wanneer.mjs from the invitation kit (appje2.html sha256:'+sha(built).slice(0,16)+
 ', eggs.css sha256:'+sha(eggsCss).slice(0,16)+', games.css sha256:'+sha(gamesCss).slice(0,16)+'). Do not edit: change the kit, then rebuild. -->';
const page='<!doctype html><html lang="nl"><head><script src="/filmmaand/identity/reset-guard.js"></script>'+
 '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'+
 '<meta name="referrer" content="no-referrer"><title>Filmmaand</title>'+head+
 '<style>'+css+'</style><style>'+eggsCss+'</style><style>'+gamesCss+'</style><style>'+PAGE_CSS+'</style></head><body>'+markup+
 '<script src="/filmmaand/identity/avatars.js"></script><script src="/filmmaand/wanneer/wanneer.js"></script><script src="/filmmaand/wanneer/games.js"></script>'+
 (FILM_MODE==='first-visit'?'':'<script src="/filmmaand/wanneer/film-mode.js"></script>')+'<script src="/filmmaand/wanneer/film-loader.js" defer></script></body></html>\n';
const eggsOut='// GENERATED by scripts/build-wanneer.mjs: verbatim copy of the invitation kit\'s eggs/eggs.js (Capsule), sha256:'+sha(eggsJs)+
 '.\n// Do not edit here. wanneer.js loads this after the first poll GET, so the eggs see the real vote state.\n'+eggsJs;

// 8. Nothing from the fixture may ship.
const gamesOut='// GENERATED by scripts/build-wanneer.mjs: verbatim copy of the invitation kit\'s eggs/games.js (Capsule), sha256:'+sha(gamesJs)+
 '.\n// Do not edit here. Loaded right after wanneer.js; talks to the chat only through window.filmmaandChat.\n'+gamesJs;
const shipped={'index.html':page,'eggs.js':eggsOut,'wanneer.js':wanneer,'games.js':gamesOut};
for(const [file,text] of Object.entries({'film.bundle.js':filmOut,'film-loader.js':filmLoader}))for(const n of fixtureNames)if(new RegExp('\\b'+n+'\\b').test(text))fail(file+' contains the sample name "'+n+'"');
for(const [file,text] of Object.entries(shipped)){
 for(const n of fixtureNames)if(new RegExp('\\b'+n+'\\b').test(text))fail(file+' contains the sample name "'+n+'"');
 if(/afm-groepsapp|CREW/.test(text))fail(file+' contains the kit fixture/state');
 if(/data:image\/(png|jpe?g|webp);base64/.test(text))fail(file+' still inlines a raster image');
}

await mkdir(root+'public/filmmaand/wanneer',{recursive:true});
await writeFile(root+'public/filmmaand/wanneer/index.html',page);
await writeFile(root+'public/filmmaand/wanneer/eggs.js',eggsOut);
await writeFile(root+'public/filmmaand/wanneer/games.js',gamesOut);
await writeFile(root+'public/filmmaand/wanneer/film.bundle.js',filmOut);
await writeFile(root+'public/filmmaand/wanneer/film-loader.js',filmLoader);
if(FILM_MODE==='first-visit')await rm(root+'public/filmmaand/wanneer/film-mode.js',{force:true});
else await writeFile(root+'public/filmmaand/wanneer/film-mode.js','// GENERATED by scripts/build-wanneer.mjs: the intro film mode (see FILM_MODE there)\nwindow.AFM_FILM_MODE='+JSON.stringify(FILM_MODE)+';\n');
for(const f of await readdir(root+'public/filmmaand/assets'))if(/^wanneer-pudding-[0-9a-f]{8}\.png$/.test(f)&&f!==catName)await rm(root+'public/filmmaand/assets/'+f);
await writeFile(root+'public/filmmaand/assets/'+catName,catBytes);
console.log(`wanneer: index.html ${(page.length/1024).toFixed(1)}K · eggs.js ${(eggsOut.length/1024).toFixed(1)}K · games.js ${(gamesOut.length/1024).toFixed(1)}K · ${catName} ${catBytes.length} B · fixture names checked: ${fixtureNames.join(', ')}`);
