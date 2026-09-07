import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLoginCodeEmail,renderAlternateLoginCodeEmail} from './email-template.mjs';

test('code remains copyable with leading zeroes and actual expiry in both parts', () => {
  const result = renderLoginCodeEmail({code:'012345',expiresAt:'2026-09-07T12:10:00.000Z'});
  assert.equal(result.subject,'Je inlogcode voor Filmmaand');
  for (const part of [result.text,result.html]) {
    assert.match(part,/012345/);
    assert.match(part,/7 september om 14:10/);
    assert.match(part,/Nederlandse tijd/);
    assert.match(part,/één keer/);
  }
  assert.doesNotMatch(result.html,/<(?:script|svg|canvas|a)\b|@import/i);
});

test('the static first-party banner has text fallback and no dynamic or tracking URL', () => {
  const {html} = renderLoginCodeEmail({code:'012345',expiresAt:'2026-09-07T12:10:00Z'});
  const images = html.match(/<img\b[^>]*>/g) || [];
  assert.equal(images.length,2);
  assert.match(images[0],/src="https:\/\/ely0030\.xyz\/filmmaand\/site\/email\/afm-moire\.png"/);
  assert.match(images[0],/alt="AFM — Filmmaand"/);
  assert.match(images[0],/width="500" height="95"/);
  assert.ok(images[1].includes('src="https://ely0030.xyz/filmmaand/site/icons/interval-black-48.png"'));
  assert.ok(images[1].includes('alt=""'));
  const withoutImage=images.reduce((body,image)=>body.replace(image,''),html);
  assert.match(withoutImage,/>ALEC FILMMAAND<\/p>/);
  assert.match(withoutImage,/012345/);
  assert.match(withoutImage,/7 september om 14:10/);
  assert.doesNotMatch(withoutImage,/https?:|<img\b/);
});

test('expiry observes Dutch winter time independently of host timezone', () => {
  const {text} = renderLoginCodeEmail({code:'999999',expiresAt:'2026-12-31T23:10:00.000Z'});
  assert.match(text,/1 januari om 00:10/);
});

test('invalid or HTML-bearing codes and invalid expiries fail before interpolation', () => {
  for (const code of ['12345','1234567','<img/>',123456,null]) {
    assert.throws(() => renderLoginCodeEmail({code,expiresAt:'2026-09-07T12:10:00Z'}),TypeError);
  }
  assert.throws(() => renderLoginCodeEmail({code:'123456',expiresAt:'invalid'}),TypeError);
});

test('review alternative preserves transactional content and only the fixed logo dependency', () => {
  const input = {code:'012345',expiresAt:'2026-09-07T12:10:00.000Z'};
  const primary = renderLoginCodeEmail(input);
  const alternative = renderAlternateLoginCodeEmail(input);
  assert.equal(alternative.text,primary.text);
  assert.equal(alternative.subject,primary.subject);
  assert.match(alternative.html,/012345/);
  assert.match(alternative.html,/7 september om 14:10/);
  const logo=alternative.html.match(/<img[^>]+>/g)||[];
  assert.equal(logo.length,1);
  assert.ok(logo[0].includes('src="https://ely0030.xyz/filmmaand/site/icons/interval-black-48.png"'));
  assert.doesNotMatch(alternative.html.replace(logo[0],''),/<(?:img|script|svg|a)\b|https?:|@import/i);
});
