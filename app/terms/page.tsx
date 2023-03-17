import {
  LegalDocumentShell,
  LegalSection,
} from '@/components/LegalDocumentShell';

export const metadata = {
  title: 'Terms — CityLens',
  description:
    'Terms for evaluation and pilot use of the CityLens acquisition-intelligence product.',
  alternates: {
    canonical: '/terms',
  },
};

const navigation = [
  { id: 'permitted-use', label: 'Permitted use' },
  { id: 'professional-advice', label: 'Professional advice' },
  { id: 'limitations', label: 'Data limitations' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'availability', label: 'Pilot availability' },
];

export default function TermsPage() {
  return (
    <LegalDocumentShell
      eyebrow="Trust center"
      title="Pilot terms of use"
      summary="Terms for evaluation and pilot use of CityLens unless a written order says otherwise."
      effectiveDate="July 17, 2026"
      navigation={navigation}
    >
      <LegalSection id="permitted-use" title="Permitted use">
        <p>
          You may use CityLens for internal property research and acquisition
          screening.
        </p>
        <p>You may not use it to:</p>
        <ul>
          <li>harass owners or make unlawful discriminatory decisions;</li>
          <li>bypass access controls or resell bulk data; or</li>
          <li>represent model output as a government determination.</li>
        </ul>
      </LegalSection>

      <LegalSection id="professional-advice" title="Not professional advice">
        <p>
          CityLens provides screening signals and workflow tools. It is not a
          brokerage, appraisal, survey, title report, zoning or legal opinion,
          environmental or engineering review, or investment recommendation.
          Verify material facts with authoritative records and qualified
          professionals.
        </p>
      </LegalSection>

      <LegalSection id="limitations" title="Data and model limitations">
        <p>
          Public records, imagery observations, ownership data, zoning fields,
          capacity calculations, and model rankings may be incomplete,
          delayed, mismatched, or wrong.
        </p>
        <p>
          Priority tiers are relative screening ranks—not probabilities,
          guarantees of availability, seller intent, or predictions that a
          parcel will transact or receive approvals.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="Accounts and acceptable use">
        <p>
          You are responsible for your account and API credentials. Do not
          upload secrets or sensitive personal information into notes. We may
          suspend access to protect the service, data subjects, or other
          users.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Pilot availability">
        <p>
          The service is provided on an evaluation basis and may change. Paid
          scope, support, confidentiality, warranties, liability, and
          termination should be governed by a written pilot order.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
