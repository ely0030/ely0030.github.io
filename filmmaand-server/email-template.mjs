/** Pure transactional template. No delivery, remote assets, links or tracking. */
export function renderLoginCodeEmail({code, expiresAt}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new TypeError('Expected a six-digit login code.');
  if (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) throw new TypeError('Expected a valid expiry timestamp.');
  // Explicit timezone makes delivery retries and server locale irrelevant.
  const expiry = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(expiresAt));
  const subject = 'Je inlogcode voor Filmmaand';
  const instruction = 'Vul deze code in op het inlogscherm van Filmmaand.';
  const validity = `Geldig tot ${expiry} (Nederlandse tijd). Je kunt de code één keer gebruiken.`;
  const safety = 'Deel deze code met niemand. Heb je niet geprobeerd in te loggen? Dan kun je deze e-mail negeren.';
  return {
    subject,
    text: `Alec Filmmaand\nSeptember 2026\n\nJe inlogcode\n\n${code}\n\n${instruction}\n\n${validity}\n\n${safety}`,
    html: `<!doctype html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#f4f2ed;color:#202622;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f2ed;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;">
        <tr><td bgcolor="#202622" style="padding:32px 28px 30px;background-color:#202622;color:#ffffff;">
          <p style="margin:0 0 34px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:16px;letter-spacing:1.5px;color:#d4d9cf;">SEPTEMBER 2026</p>
          <p style="margin:0;font-family:'Canela Trial',Georgia,'Times New Roman',serif;font-size:40px;line-height:44px;font-weight:400;letter-spacing:-1.5px;color:#ffffff;">Alec<br>Filmmaand</p>
        </td></tr>
        <tr><td style="padding:15px 28px;border-bottom:1px solid #deded8;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:16px;letter-spacing:1.2px;color:#565d52;">JOUW FILMMAAND BEGINT HIER</p></td></tr>
        <tr><td style="padding:32px 28px 28px;">
          <h1 style="margin:0 0 14px;font-family:'Canela Trial',Georgia,'Times New Roman',serif;font-size:34px;line-height:40px;font-weight:400;letter-spacing:-1px;">Je inlogcode.</h1>
          <p style="margin:0 0 25px;color:#555950;font-size:14px;line-height:23px;">${instruction}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f2ed;border-top:1px solid #d5d3c9;border-bottom:1px solid #d5d3c9;">
            <tr><td style="padding:14px 20px 12px;border-bottom:1px dashed #c5c7ba;font-size:10px;line-height:16px;letter-spacing:1px;color:#565d52;">EENMALIGE INLOGCODE</td></tr>
            <tr><td align="center" style="padding:21px 10px 23px;font-family:'Courier New',Courier,monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:5px;color:#202622;">${code}</td></tr>
          </table>
          <p style="margin:18px 0 0;color:#62675d;font-size:12px;line-height:20px;">${validity}</p>
        </td></tr>
        <tr><td style="padding:22px 28px 28px;border-top:1px solid #deded8;"><p style="margin:0;color:#62675d;font-size:12px;line-height:20px;">${safety}</p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}
