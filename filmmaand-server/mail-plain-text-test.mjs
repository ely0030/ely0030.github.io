/** Operator-configured, single-use experiment. No header means normal production mail. */
import {createHash} from 'node:crypto';
export function selectPlainTextTest(state,{plan,token,to,now}){
 if(!token)return false;
 const hash=typeof token==='string'&&token.length>=32&&token.length<=256?createHash('sha256').update(token).digest('hex'):null;
 if(!hash||!plan||hash!==plan.tokenSha256||to!==plan.recipient||!(Date.parse(plan.expiresAt)>Date.parse(now))||state.mailPlainTextTests?.[hash]){
  throw Object.assign(Error('Deze e-mailtest is niet beschikbaar.'),{status:400,code:'mail_test_unavailable'});
 }
 // Persisted with the queued message by the existing CAS transaction, never with the raw token.
 state.mailPlainTextTests||={};state.mailPlainTextTests[hash]=now;
 return true;
}
