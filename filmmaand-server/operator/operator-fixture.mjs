// Exact removal function from scripts/social-fixture.mjs; no runtime/database imports.
// Function SHA256: 84fa605215d35f9ea3671a82f18239e1f6a7ae5883de66637ce3aa83ce9f982e
export const fixtureId='social-friends-v1';
export function removeFixture(input){
 const m=input.fixtureGroups?.[fixtureId];if(!m)throw Error('Fixture not installed.');
 const data=structuredClone(input),actors=new Set(m.actors.map(a=>a.actor)),ids=new Set(m.optionIds);
 // Never remove a film once a real participant or organizer has used it.
 const refs=[...Object.entries(data.responses||{}).filter(([a])=>!actors.has(a)).flatMap(([,r])=>r.choices||[]),...Object.entries(data.votes||{}).filter(([a])=>!actors.has(a)).flatMap(([,v])=>[v.final,v.next]),...Object.entries(data.nightProposals||{}).filter(([a])=>!actors.has(a)).map(([,p])=>p.optionId),...(data.programme||[]).flatMap(n=>n.choices||[]),...(data.confirmation?.choices||[]),...(data.round?.shortlist||[])];
 if(refs.some(id=>ids.has(id)))throw Error('A fixture suggestion is now referenced by real state; removal stopped without changes.');
 if(m.actors.some(a=>data.claimedBy?.[a.actor]))throw Error('A fixture actor was claimed; removal stopped.');
 for(const field of ['responses','displayProfiles','nightProposals','votes'])for(const a of actors)if(data[field])delete data[field][a];
 for(const key of Object.keys(data.receipts||{}))if(actors.has(key.split(':')[0]))delete data.receipts[key];
 data.options=data.options.filter(o=>!ids.has(o.id));delete data.fixtureGroups[fixtureId];if(!Object.keys(data.fixtureGroups).length)delete data.fixtureGroups;
 data.version++;return data;
}
