/**
 * Décodage minimal d'un certificat X.509 (DER encodé en base64), sans dépendance :
 * même code sous Node et sur Cloudflare Workers.
 *
 * Produit la même forme que le champ `certificateDetails` de l'API peppol.helger.com
 * (subject / issuer avec le DN au format RFC 2253 « CN=…,OU=…,O=…,C=… », serial16, dates UTC
 * « 2028-03-03T23:59:59 », validByDate), pour réutiliser helgerParser.js tel quel.
 */

/** Noms courts des attributs de DN (ceux qu'utilise Java pour RFC 2253, plus les fréquents). */
const ATTRIBUTE_NAMES = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.9': 'STREET',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '0.9.2342.19200300.100.1.1': 'UID',
  '0.9.2342.19200300.100.1.25': 'DC',
};

const SIGNATURE_ALGORITHMS = {
  '1.2.840.113549.1.1.5': 'SHA1withRSA',
  '1.2.840.113549.1.1.11': 'SHA256withRSA',
  '1.2.840.113549.1.1.12': 'SHA384withRSA',
  '1.2.840.113549.1.1.13': 'SHA512withRSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.3.2': 'SHA256withECDSA',
  '1.2.840.10045.4.3.3': 'SHA384withECDSA',
  '1.2.840.10045.4.3.4': 'SHA512withECDSA',
};

/** Lit un élément DER à la position `pos` : { tag, start (début du contenu), end }. */
function readTlv(bytes, pos) {
  const tag = bytes[pos];
  let len = bytes[pos + 1];
  let start = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + bytes[start + i];
    start += n;
  }
  if (start + len > bytes.length) throw new Error('Certificat tronqué');
  return { tag, start, end: start + len };
}

/** Enfants d'un élément construit (SEQUENCE, SET, [n]). */
function readChildren(bytes, tlv) {
  const out = [];
  for (let pos = tlv.start; pos < tlv.end; ) {
    const c = readTlv(bytes, pos);
    out.push(c);
    pos = c.end;
  }
  return out;
}

function readOid(bytes, { start, end }) {
  const parts = [Math.floor(bytes[start] / 40), bytes[start] % 40];
  let value = 0;
  for (let i = start + 1; i < end; i++) {
    value = value * 128 + (bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
}

const toHex = (bytes, { start, end }) => Array.from(bytes.subarray(start, end), (b) => b.toString(16).padStart(2, '0')).join('');

function readString(bytes, { tag, start, end }) {
  const slice = bytes.subarray(start, end);
  if (tag === 0x1e) {
    // BMPString (UTF-16 big-endian)
    let s = '';
    for (let i = 0; i + 1 < slice.length; i += 2) s += String.fromCharCode((slice[i] << 8) | slice[i + 1]);
    return s;
  }
  return new TextDecoder().decode(slice);
}

/** UTCTime (AAMMJJ…) ou GeneralizedTime (AAAAMMJJ…) → « AAAA-MM-JJTHH:MM:SS » (UTC). */
function readTime(bytes, tlv) {
  const s = readString(bytes, tlv);
  const full = tlv.tag === 0x17 ? `${Number(s.slice(0, 2)) < 50 ? '20' : '19'}${s}` : s;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/.exec(full);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}`;
}

/** Échappement RFC 2253, comme X500Principal.getName() en Java. */
const escapeDnValue = (v) => v.replace(/[,+"\\<>;]/g, '\\$&').replace(/^[ #]/, '\\$&').replace(/ $/, '\\ ');

/** Name (SEQUENCE de SET de AttributeTypeAndValue) → { name: "CN=…,O=…", CN, O, … }. */
function readName(bytes, tlv) {
  const rdns = [];
  const fields = {};
  for (const set of readChildren(bytes, tlv)) {
    const atvs = readChildren(bytes, set).map((seq) => {
      const [oidTlv, valueTlv] = readChildren(bytes, seq);
      const oid = readOid(bytes, oidTlv);
      const key = ATTRIBUTE_NAMES[oid];
      // Attribut inconnu : comme Java, OID=#<encodage DER complet de la valeur en hexadécimal>
      if (!key) return `${oid}=#${toHex(bytes, { start: oidTlv.end, end: valueTlv.end })}`;
      const value = readString(bytes, valueTlv);
      fields[key] = value;
      return `${key}=${escapeDnValue(value)}`;
    });
    rdns.push(atvs.join('+'));
  }
  // RFC 2253 : du dernier RDN au premier
  return { name: rdns.reverse().join(','), ...fields };
}

/** Base64 (éventuellement avec retours à la ligne ou en-têtes PEM) → octets. */
function base64ToBytes(b64) {
  const clean = b64.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Décode un certificat X.509.
 * @param {string} base64Der contenu de l'élément <Certificate> d'un SMP
 * @param {Date} [now] date de référence pour validByDate
 * @returns {{ parsable: boolean, subject?: Object, issuer?: Object, serial10?: string, serial16?: string,
 *             notBefore?: string|null, notAfter?: string|null, validByDate?: boolean|null, sigAlgName?: string|null }}
 */
export function parseCertificate(base64Der, now = new Date()) {
  try {
    const bytes = base64ToBytes(base64Der);
    const cert = readTlv(bytes, 0);
    const [tbs, sigAlg] = readChildren(bytes, cert);
    const fields = readChildren(bytes, tbs);
    // Champ version facultatif, étiqueté [0]
    const offset = fields[0].tag === 0xa0 ? 1 : 0;
    const serialTlv = fields[offset];
    const issuer = readName(bytes, fields[offset + 2]);
    const [notBeforeTlv, notAfterTlv] = readChildren(bytes, fields[offset + 3]);
    const subject = readName(bytes, fields[offset + 4]);

    const serialHex = toHex(bytes, serialTlv).replace(/^0+(?=.)/, '');
    const notBefore = readTime(bytes, notBeforeTlv);
    const notAfter = readTime(bytes, notAfterTlv);
    const toDate = (s) => (s ? new Date(`${s}Z`) : null);
    const validByDate = notBefore && notAfter ? now >= toDate(notBefore) && now <= toDate(notAfter) : null;
    const sigOid = readOid(bytes, readChildren(bytes, sigAlg)[0]);

    return {
      parsable: true,
      subject,
      issuer,
      // En chaîne : le numéro dépasse la précision des nombres JS
      serial10: BigInt(`0x${serialHex}`).toString(),
      serial16: serialHex,
      notBefore,
      notAfter,
      validByDate,
      sigAlgName: SIGNATURE_ALGORITHMS[sigOid] || sigOid,
    };
  } catch {
    return { parsable: false };
  }
}
