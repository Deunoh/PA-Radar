/**
 * Lecteur XML minimal, sans dépendance : Cloudflare Workers n'a pas de DOMParser.
 * Suffisant pour les réponses des SMP Peppol (pas de DTD). Les préfixes d'espace de noms
 * (ns2:, ns3:… variables d'un SMP à l'autre) sont retirés : on travaille sur les noms locaux.
 */

/**
 * @typedef {Object} XmlElement
 * @property {string} name         nom local (sans préfixe)
 * @property {Record<string, string>} attrs  attributs, noms locaux
 * @property {XmlElement[]} children
 * @property {string} text         texte direct (hors enfants), sans espaces autour
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });

const localName = (qname) => qname.slice(qname.indexOf(':') + 1);

/**
 * Analyse un document XML et renvoie son élément racine.
 * @param {string} xml
 * @returns {XmlElement}
 */
export function parseXml(xml) {
  const root = { name: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  const textParts = [[]];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, cdata, closing, opening, rawAttrs, selfClosing, text] = m;
    if (cdata !== undefined) textParts.at(-1).push(cdata);
    else if (text !== undefined) textParts.at(-1).push(decode(text));
    else if (opening) {
      const attrs = {};
      for (const a of rawAttrs.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        if (a[1] === 'xmlns' || a[1].startsWith('xmlns:')) continue;
        attrs[localName(a[1])] = decode(a[2] ?? a[3]);
      }
      const el = { name: localName(opening), attrs, children: [], text: '' };
      stack.at(-1).children.push(el);
      if (!selfClosing) {
        stack.push(el);
        textParts.push([]);
      }
    } else if (closing) {
      if (stack.length < 2 || stack.at(-1).name !== localName(closing)) throw new Error(`XML mal formé : </${closing}> inattendu`);
      stack.pop().text = textParts.pop().join('').trim();
    }
  }
  if (stack.length !== 1) throw new Error('XML mal formé : élément non fermé');
  const top = root.children[0];
  if (!top) throw new Error('XML vide');
  return top;
}

/** Premier enfant direct portant ce nom local. */
export const child = (el, name) => el?.children.find((c) => c.name === name) ?? null;

/** Tous les enfants directs portant ce nom local. */
export const childrenNamed = (el, name) => el?.children.filter((c) => c.name === name) ?? [];

/** Texte du premier enfant direct portant ce nom local (null s'il est absent ou vide). */
export const childText = (el, name) => child(el, name)?.text || null;

/** Premier descendant (en profondeur) portant ce nom local. */
export function find(el, name) {
  for (const c of el?.children ?? []) {
    if (c.name === name) return c;
    const found = find(c, name);
    if (found) return found;
  }
  return null;
}
