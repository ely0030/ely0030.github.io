/** One explicit switch opens eligibility and delivery together; default remains restricted. */
export function registrationPolicy(env={}) {
 const publicRegistration=env.AUTH_REGISTRATION==='public';
 return {
  allowAnyRecipient:publicRegistration,
  allowList:publicRegistration?null:(env.AUTH_ALLOW_LIST?new Set(env.AUTH_ALLOW_LIST.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)):null),
  allowedRecipients:(env.AUTH_MAIL_ALLOW||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
 };
}
