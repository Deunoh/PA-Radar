/**
 * Tests de la traduction XML des SMP vers le format Helger, sur de vraies réponses
 * (tests/fixtures/direct/) comparées aux réponses de peppol.helger.com pour le même participant.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseXml, child, childText } from '../src/server/parsing/xml.js';
import { parseCertificate } from '../src/server/parsing/x509.js';
import {
  parseServiceGroupXml,
  parseBusinessCardXml,
  parseServiceMetadataXml,
  toHelgerDate,
  describeDocumentType,
} from '../src/server/parsing/smpParser.js';
import { parseDocumentTypes, extractEndpoints, chooseReferenceDocumentType } from '../src/server/parsing/helgerParser.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const NOW = new Date('2026-11-08T12:00:00Z');

describe('parseXml', () => {
  it('retire les préfixes, décode les entités et lit CDATA et balises auto-fermantes', () => {
    const root = parseXml(
      '<?xml version="1.0"?><!-- c --><a:Root xmlns:a="urn:x" a:id="1"><a:B>x &amp; y &#233;</a:B><C/><D><![CDATA[<brut>]]></D></a:Root>',
    );
    expect(root.name).toBe('Root');
    expect(root.attrs).toEqual({ id: '1' });
    expect(parseXml('<a><b>texte </b></a>').children[0].text).toBe('texte ');
    expect(childText(root, 'B')).toBe('x & y é');
    expect(child(root, 'C')).toMatchObject({ name: 'C', children: [] });
    expect(childText(root, 'D')).toBe('<brut>');
  });

  it('refuse un XML mal formé', () => {
    expect(() => parseXml('<a><b></a>')).toThrow();
    expect(() => parseXml('<a>')).toThrow();
  });
});

describe('parseCertificate', () => {
  it('donne exactement le même résultat que Helger', () => {
    const ep = JSON.parse(fixture('endpoint-0225-france-invoice.json')).serviceinfo.processes[0].endpoints[0];
    const { serial10, ...expected } = ep.certificateDetails;
    const { serial10: mySerial10, ...mine } = parseCertificate(ep.certificate, NOW);
    expect(mine).toEqual(expected);
    expect(mySerial10).toBe(BigInt(`0x${expected.serial16}`).toString());
  });

  it('signale un certificat illisible sans lever d\'erreur', () => {
    expect(parseCertificate('pas un certificat')).toEqual({ parsable: false });
  });
});

describe('toHelgerDate / describeDocumentType', () => {
  it('retire le fuseau des dates SMP sans changer l\'heure, comme Helger', () => {
    expect(toHelgerDate('2026-02-09T00:00:00Z')).toBe('2026-02-09T00:00:00');
    expect(toHelgerDate('2026-09-01T00:00:00+02:00')).toBe('2026-09-01T00:00:00');
    expect(toHelgerDate('2026-07-08T23:30:33.988194+02:00')).toBe('2026-07-08T23:30:33.988194');
    expect(toHelgerDate('2026-04-09T09:01:58.607')).toBe('2026-04-09T09:01:58.607');
    expect(toHelgerDate('2025-01-01T00:00:00.000Z')).toBe('2025-01-01T00:00:00');
    expect(toHelgerDate('2025-01-01T00:00:00.5Z')).toBe('2025-01-01T00:00:00.500');
    expect(toHelgerDate(null)).toBeNull();
  });

  it('nomme les types PINT comme Helger (correspondance exacte ou générique)', () => {
    const pint = 'peppol-doctype-wildcard::urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:peppol:pint:';
    expect(describeDocumentType(`${pint}billing-1*::2.1`).niceName).toBe('Peppol PINT Credit Note v1.0 (PINT wildcard match)');
    expect(describeDocumentType(`${pint}billing-1@my-1*::2.1`).niceName).toBe('MY PINT Credit Note v1.0 (PINT wildcard match)');
    expect(describeDocumentType(`${pint}selfbilling-1@aunz-1::2.1`).niceName).toBe(
      'A-NZ PINT Self-Billing Credit Note v1.0 (PINT exact match)',
    );
  });

  it('donne le nom officiel d\'un type de document, et rien pour un type inconnu', () => {
    expect(
      describeDocumentType(
        'busdox-docid-qns::urn:peppol:doctype:pdf+xml##urn:cen.eu:en16931:2017#conformant#urn:peppol:france:billing:Factur-X:1.0::D22B',
      ),
    ).toEqual({ niceName: 'France Factur-X', state: 'act', isDeprecated: false });
    expect(describeDocumentType('busdox-docid-qns::inconnu')).toEqual({ state: null, isDeprecated: false });
  });
});

describe('parseServiceGroupXml', () => {
  const raw = parseServiceGroupXml(fixture('direct/servicegroup-0225-552032534_danonesender.xml'));

  it('liste les types de documents triés comme Helger, avec leurs noms', () => {
    expect(raw.participantID).toBe('iso6523-actorid-upis::0225:552032534_danonesender');
    expect(raw.urls).toHaveLength(10);
    expect(raw.urls.map((u) => u.niceName)).toEqual([
      'Peppol BIS Billing UBL Credit Note V3',
      'France UBL Credit Note CIUS',
      'France UBL Credit Note Extension',
      'Peppol BIS Billing UBL Invoice V3',
      'France UBL Invoice CIUS',
      'France UBL Invoice Extension',
      'France Factur-X',
      'France CDAR',
      'France CII Invoice CIUS',
      'France CII Invoice Extension',
    ]);
    expect(raw.urls[0].documentTypeID).toBe(
      'busdox-docid-qns::urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1',
    );
  });

  it('choisit le même type de document de référence que Helger', () => {
    expect(chooseReferenceDocumentType(parseDocumentTypes(raw.urls)).niceName).toBe('France UBL Invoice CIUS');
  });
});

describe('parseBusinessCardXml', () => {
  it('produit la même Business Card que Helger', () => {
    expect(parseBusinessCardXml(fixture('direct/businesscard-0225-552032534_danonesender.xml'))).toEqual({
      participant: { scheme: 'iso6523-actorid-upis', value: '0225:552032534_danonesender' },
      entity: [{ name: [{ name: 'DANONE', language: 'en' }], countrycode: 'FR', regdate: '2026-09-01' }],
    });
  });

  it('lit adresse, statut, site et contacts', () => {
    const xml = `<?xml version="1.0"?><ns5:BusinessCard xmlns:ns5="http://www.peppol.eu/schema/pd/businesscard/20180621/">
      <ns5:ParticipantIdentifier scheme="iso6523-actorid-upis">0225:750620585</ns5:ParticipantIdentifier>
      <ns5:BusinessEntity registrationDate="2026-08-27"><ns5:Name language="fr">EARL BISONS D'AUVERGNE</ns5:Name>
      <ns5:CountryCode>FR</ns5:CountryCode><ns5:GeographicalInformation>LD LE PLAIX 03240 ROCLES</ns5:GeographicalInformation>
      <ns5:WebsiteURI>https://exemple.fr</ns5:WebsiteURI><ns5:Contact TypeCode="support" Email="a@exemple.fr"/>
      <ns5:AdditionalInformation>FR_ASSUJETTI_ACTIVE</ns5:AdditionalInformation></ns5:BusinessEntity></ns5:BusinessCard>`;
    expect(parseBusinessCardXml(xml).entity[0]).toEqual({
      name: [{ name: "EARL BISONS D'AUVERGNE", language: 'fr' }],
      countrycode: 'FR',
      geoinfo: 'LD LE PLAIX 03240 ROCLES',
      websiteuri: ['https://exemple.fr'],
      contact: [{ type: 'support', name: null, phonenumber: null, email: 'a@exemple.fr' }],
      additionalinfo: 'FR_ASSUJETTI_ACTIVE',
      regdate: '2026-08-27',
    });
  });
});

describe('parseServiceMetadataXml', () => {
  it('produit les mêmes champs que Helger pour le point d\'accès', () => {
    const raw = parseServiceMetadataXml(fixture('direct/servicemetadata-0225-552032534_danonesender-facturx.xml'), NOW);
    expect(raw.documentTypeID).toBe(
      'busdox-docid-qns::urn:peppol:doctype:pdf+xml##urn:cen.eu:en16931:2017#conformant#urn:peppol:france:billing:Factur-X:1.0::D22B',
    );
    const process = raw.serviceinfo.processes[0];
    expect(process.processID).toBe('cenbii-procid-ubl::urn:peppol:france:billing:regulated');
    const { certificate, certificateDetails, ...endpoint } = process.endpoints[0];
    // Valeurs relevées dans la réponse de Helger pour ce même point d'accès
    expect(endpoint).toEqual({
      transportProfile: 'peppol-transport-as4-v2_0',
      endpointReference: 'https://peppol-cf-cust-eu02.prod.apimanagement.eu02.hana.ondemand.com/as4/peppol',
      requireBusinessLevelSignature: false,
      minimumAuthenticationLevel: '1',
      serviceActivationDate: '2026-02-09T00:00:00',
      serviceExpirationDate: '2036-02-09T00:00:00',
      serviceDescription: 'SAP Access Point AS4 (CF CUST EU02)',
      technicalContactUrl: 'PEPPOL_APGS_Support@sap.com',
      technicalInformationUrl: 'https://help.sap.com/viewer/product/DC_PEPPOL',
      extension: null,
    });
    expect(certificate).toMatch(/^MIIFcDCCA1ig/);
    expect(certificateDetails).toMatchObject({
      subject: { name: 'CN=PDE000237,OU=PEPPOL PRODUCTION AP,O=SAP SE,C=DE', O: 'SAP SE', CN: 'PDE000237' },
      issuer: { name: 'CN=PEPPOL ACCESS POINT CA - G3,O=OpenPEPPOL AISBL,C=BE' },
      serial16: '10a45f2fc494400421fa06041b8d7af69edea798',
      notBefore: '2026-03-12T00:00:00',
      notAfter: '2028-02-29T23:59:59',
      validByDate: true,
    });

    const [normalized] = extractEndpoints(raw);
    expect(normalized).toMatchObject({
      processIds: ['urn:peppol:france:billing:regulated'],
      certificate: { operator: 'SAP SE', popId: 'PDE000237', serial: '10a45f2fc494400421fa06041b8d7af69edea798' },
    });
  });

  it('signale une redirection vers un autre SMP', () => {
    const xml = `<SignedServiceMetadata xmlns="http://busdox.org/serviceMetadata/publishing/1.0/"><ServiceMetadata>
      <Redirect href="https://autre-smp.exemple/x"><CertificateUID>abc</CertificateUID></Redirect></ServiceMetadata></SignedServiceMetadata>`;
    expect(parseServiceMetadataXml(xml)).toEqual({ redirect: 'https://autre-smp.exemple/x' });
  });
});
