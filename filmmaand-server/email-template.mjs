/** Pure login email renderer. Approved B programme direction; no remote assets or tracking. */
export function renderLoginCodeEmail(input) { return render(input, 'programme'); }
/** Review-only alternative. Production callers retain renderLoginCodeEmail. */
export function renderAlternateLoginCodeEmail(input) { return render(input, 'editorial'); }

function render({code, expiresAt}, direction) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new TypeError('Expected a six-digit login code.');
  if (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) throw new TypeError('Expected a valid expiry timestamp.');
  const expiry = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(expiresAt));
  const subject = 'Je inlogcode voor Filmmaand';
  const instruction = 'Vul deze code in op het inlogscherm van Filmmaand.';
  const validity = `Geldig tot ${expiry} (Nederlandse tijd).`;
  const use = 'Je kunt de code één keer gebruiken. Deel hem met niemand.';
  const safety = 'Heb je niet geprobeerd in te loggen? Dan kun je deze e-mail negeren.';
  const text = `Alec Filmmaand\n\nJe inlogcode\n\n${code}\n\n${instruction}\n\n${validity}\n${use}\n\n${safety}`;
  const serif = "Georgia,'Times New Roman',serif";
  const sans = 'Arial,Helvetica,sans-serif';
  const editorial = `
    <tr><td style="padding:0 0 26px;border-bottom:1px solid #d9d9d2;">
      <p style="margin:0;font-family:${serif};font-size:30px;line-height:38px;font-weight:400;letter-spacing:-1.1px;color:#20221e;">Alec Filmmaand</p>
    </td></tr>
    <tr><td style="padding:36px 0 0;">
      <h1 style="margin:0 0 18px;font-family:${serif};font-size:38px;line-height:44px;font-weight:400;letter-spacing:-1.5px;">Je inlogcode</h1>
      <p style="margin:0;font-size:15px;line-height:24px;color:#4e504b;">${instruction}</p>
      <p style="margin:30px 0 26px;font-family:${sans};font-size:42px;line-height:52px;font-weight:400;letter-spacing:7px;color:#20221e;">${code}</p>
      <p style="margin:0 0 10px;font-size:13px;line-height:21px;color:#4e504b;">${validity}</p>
      <p style="margin:0;font-size:13px;line-height:21px;color:#4e504b;">${use}</p>
    </td></tr>
    <tr><td style="padding:32px 0 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:20px 0 0;border-top:1px solid #d9d9d2;"><p style="margin:0;font-size:12px;line-height:20px;color:#6b6c67;">${safety}</p></td></tr></table></td></tr>`;
  const programme = `
    <tr><td style="padding:0 0 22px;border-bottom:3px solid #20221e;">
      <p style="margin:0;font-family:${sans};font-size:17px;line-height:22px;font-weight:700;letter-spacing:-0.3px;">ALEC FILMMAAND</p>
    </td></tr>
    <tr><td style="padding:34px 0 0;">
      <h1 style="margin:0 0 18px;font-family:${sans};font-size:26px;line-height:32px;font-weight:400;letter-spacing:-0.7px;">Je inlogcode</h1>
      <p style="margin:0;font-size:15px;line-height:24px;color:#4e504b;">${instruction}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:28px 0 24px;"><p style="margin:0;font-family:${sans};font-size:48px;line-height:58px;font-weight:700;letter-spacing:4px;color:#20221e;">${code}</p></td></tr></table>
      <p style="margin:0 0 10px;font-size:13px;line-height:21px;color:#4e504b;">${validity}</p>
      <p style="margin:0;font-size:13px;line-height:21px;color:#4e504b;">${use}</p>
    </td></tr>
    <tr><td style="padding:32px 0 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:20px 0 0;border-top:1px solid #d9d9d2;"><p style="margin:0;font-size:12px;line-height:20px;color:#6b6c67;">${safety}</p></td></tr></table></td></tr>`;
  return {subject,text,html:`<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;color:#20221e;font-family:${sans};font-weight:400;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td align="center" style="padding:40px 28px 48px;">
<!--[if mso]><table role="presentation" width="500" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:500px;">${direction==='editorial'?editorial:programme}</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`};
}
