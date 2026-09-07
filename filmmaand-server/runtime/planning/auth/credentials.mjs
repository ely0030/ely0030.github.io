// Credential namespaces. Disjoint by construction: an anonymous bearer is exactly 43 base64url characters, a session token
// is 'fms_' + 43, a participant actor key is 'p_' + id. Hex sha256 actor hashes can never collide with 'p_…'.
export const SESSION_PREFIX='fms_';
export const isSessionToken=t=>typeof t==='string'&&/^fms_[A-Za-z0-9_-]{43}$/.test(t);
export const isAnonymousBearer=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
export const participantActor=id=>'p_'+id;
export const isParticipantActor=a=>typeof a==='string'&&a.startsWith('p_');
