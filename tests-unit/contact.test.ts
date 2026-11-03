import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PHONE_LINES, SOCIAL_LINKS } from '@/data/contact';
import { displayPhone, telHref } from '@/lib/phone';
import { PhoneLines, SocialLinks } from '@/components/layout/contact-channels';

// The store's phone lines and social pages (footer and contact page). The numbers are pinned here as the owner gave
// them, so a slip of one digit in src/data/contact.ts fails a test instead of reaching customers.

describe('phone numbers', () => {
  it('dial in international form, from any phone', () => {
    assert.equal(telHref('02163128962'), 'tel:+982163128962');
    assert.equal(telHref('09026450596'), 'tel:+989026450596');
    assert.equal(telHref('09199181261'), 'tel:+989199181261');
  });

  it('read in Persian digits, grouped the way they are said aloud', () => {
    assert.equal(displayPhone('02163128962'), '۰۲۱ ۶۳۱۲ ۸۹۶۲');
    assert.equal(displayPhone('09026450596'), '۰۹۰۲ ۶۴۵ ۰۵۹۶');
    assert.equal(displayPhone('09199181261'), '۰۹۱۹ ۹۱۸ ۱۲۶۱');
  });

  it('refuse anything but an 11-digit number starting with 0, such as one with a digit missing', () => {
    for (const wrong of ['0919981261', '091991812611', '9199181261', '+989199181261', '0919 918 1261', '۰۹۱۹۹۱۸۱۲۶۱', '00000000000', '']) {
      assert.throws(() => telHref(wrong), /11-digit/, wrong);
      assert.throws(() => displayPhone(wrong), /11-digit/, wrong);
    }
  });
});

describe('contact details', () => {
  it('lists the store, support and wholesale lines the owner gave', () => {
    assert.deepEqual(PHONE_LINES.map(({ label, number }) => [label, number]), [
      ['فروشگاه', '02163128962'],
      ['پشتیبانی', '09026450596'],
      ['فروش عمده', '09199181261']
    ]);
  });

  it('links to the Instagram page and the Bale channel, over https', () => {
    assert.deepEqual(SOCIAL_LINKS.map(({ id, label, href }) => [id, label, href]), [
      ['instagram', 'اینستاگرام', 'https://www.instagram.com/kasra_boutiquee/'],
      ['bale', 'کانال بله', 'https://ble.ir/kasraboutique']
    ]);
  });
});

describe('contact pieces', () => {
  it('make each phone line one call link: its name, then its number read left to right', () => {
    const html = renderToStaticMarkup(createElement(PhoneLines));
    const links = [...html.matchAll(/<a class="phone-line" href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
    assert.deepEqual(links.map(([, href]) => href), ['tel:+982163128962', 'tel:+989026450596', 'tel:+989199181261']);
    assert.match(links[0][2], /<span class="sr-only">تماس با <\/span>فروشگاه/);
    assert.match(links[0][2], /<span class="phone-line-number" dir="ltr">۰۲۱ ۶۳۱۲ ۸۹۶۲<\/span>/);
  });

  it('open the social pages in a new tab without handing them this page, and say so to screen readers', () => {
    const html = renderToStaticMarkup(createElement(SocialLinks));
    const links = [...html.matchAll(/<a [^>]*>/g)].map(([tag]) => tag);
    assert.equal(links.length, 2);
    for (const tag of links) {
      assert.match(tag, /target="_blank"/);
      assert.match(tag, /rel="noopener noreferrer"/);
    }
    assert.match(links[0], /href="https:\/\/www\.instagram\.com\/kasra_boutiquee\/"/);
    assert.match(links[0], /aria-label="اینستاگرام کسری بوتیک \(در پنجره تازه\)"/);
    assert.match(links[1], /href="https:\/\/ble\.ir\/kasraboutique"/);
    assert.match(links[1], /aria-label="کانال بله کسری بوتیک \(در پنجره تازه\)"/);
  });

  it('draw the logos in their own colours, each copy filled from its own gradient', () => {
    // The contact page renders the icons twice (in the page and in the footer it hides there).
    const html = renderToStaticMarkup(createElement(Fragment, null, createElement(SocialLinks), createElement(SocialLinks)));
    const ids = [...html.matchAll(/<(?:radial|linear)Gradient id="([^"]+)"/g)].map(([, id]) => id);
    const fills = [...html.matchAll(/fill="url\(#([^)]+)\)"/g)].map(([, id]) => id);
    assert.equal(ids.length, 4);
    assert.equal(new Set(ids).size, 4, 'gradient ids are unique');
    assert.deepEqual(fills, ids, 'each logo uses the gradient defined beside it');
    assert.match(html, /stop-color="#D6249F"/, 'Instagram magenta');
    assert.match(html, /stop-color="#3D8C94"/, 'Bale teal');
  });
});
