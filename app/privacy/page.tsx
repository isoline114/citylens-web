import {
  LegalDocumentShell,
  LegalSection,
} from '@/components/LegalDocumentShell';

export const metadata = {
  title: 'Privacy — CityLens',
  description:
    'How CityLens handles account, workflow, public-property, pilot, and aggregate usage data.',
  alternates: {
    canonical: '/privacy',
  },
};

const navigation = [
  { id: 'information', label: 'Information' },
  { id: 'measurement', label: 'Measurement' },
  { id: 'purpose', label: 'Purpose' },
  { id: 'public-records', label: 'Public records' },
  { id: 'sharing-retention', label: 'Sharing & retention' },
  { id: 'choices', label: 'Your choices' },
];

export default function PrivacyPage() {
  return (
    <LegalDocumentShell
      eyebrow="Trust center"
      title="Privacy notice"
      summary="How CityLens handles account, workflow, pilot, public-property, and aggregate usage data."
      effectiveDate="July 24, 2026"
      navigation={navigation}
    >
      <LegalSection id="information" title="Information we process">
        <p>
          CityLens processes account identifiers, authentication events, API
          usage, saved parcel workflows and searches, support messages, and
          information submitted with a pilot request.
        </p>
        <p>
          Notes and tags are user-provided. Do not place sensitive personal
          information in them.
        </p>
      </LegalSection>

      <LegalSection id="measurement" title="Privacy-preserving measurement">
        <p>
          We keep bounded daily counts of coarse product actions and where
          they began. These counts help us understand whether people reach
          useful workflows without recording the underlying parcel or
          decision.
        </p>
        <ul>
          <li>
            Counters exclude parcel and saved-view identifiers, addresses,
            owners, queries, filters, result counts, notes, contacts,
            assignees, and other free text.
          </li>
          <li>
            Underwriting inputs, costs, margins, efficiencies, and changed
            assumptions are not included.
          </li>
          <li>
            Aggregate counters are scheduled for deletion within 90 days.
          </li>
          <li>
            Pageview URLs have query parameters and fragments removed before
            collection.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="purpose" title="Why we process it">
        <p>
          We use this information to provide and secure CityLens, enforce
          quotas, synchronize acquisition workflow, diagnose failures,
          improve the product, and respond to requested pilots.
        </p>
      </LegalSection>

      <LegalSection id="public-records" title="Public property information">
        <p>
          Parcel, ownership, deed, zoning, permit, and imagery-derived
          information is assembled primarily from public government records
          and licensed or public imagery. Source information can be
          incomplete, delayed, or outdated.
        </p>
      </LegalSection>

      <LegalSection id="sharing-retention" title="Sharing and retention">
        <p>
          We use infrastructure and authentication providers to operate
          CityLens. We do not sell account information.
        </p>
        <ul>
          <li>Aggregate product counters expire within 90 days.</li>
          <li>
            Pilot requests are scheduled to expire within 365 days unless
            they become part of a customer relationship or must be retained
            for legal or security reasons.
          </li>
          <li>
            Account, security, support, and user-created workflow records may
            be retained as needed to provide the service and meet legal or
            security obligations.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="choices" title="Your choices">
        <p>
          Contact{' '}
          <a href="mailto:hello@citylens.dev">hello@citylens.dev</a> to request
          access, correction, export, or deletion of your account data. Some
          security and legal records may need to be retained.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
