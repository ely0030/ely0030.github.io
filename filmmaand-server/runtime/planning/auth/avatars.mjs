import {readFileSync} from 'node:fs';
// The browser registry (window.filmmaandAvatarOptions = [...]) is the single source of truth for avatar ids,
// active flags and presentation order. Evaluate it in a throwaway scope instead of duplicating the list.
export function loadAvatarOptions(path=new URL('../../artifacts/identity-studio/avatars.js',import.meta.url)){
 const source=readFileSync(path,'utf8'),window={};new Function('window',source)(window);
 const list=window.filmmaandAvatarOptions;if(!Array.isArray(list)||!list.length)throw new Error('avatars.js did not define filmmaandAvatarOptions');
 return list.map(a=>({id:a.id,label:a.label,active:a.active!==false}));
}
