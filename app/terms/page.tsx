export const metadata = { title: 'Terms — CityLens' };

export default function TermsPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl py-8">
      <h1>Pilot terms of use</h1>
      <p><strong>Effective July 17, 2026.</strong> These terms apply to evaluation and pilot use of CityLens unless a written order says otherwise.</p>
      <h2>Permitted use</h2>
      <p>You may use CityLens for internal property research and acquisition screening. You may not use it to harass owners, make unlawful discriminatory decisions, bypass access controls, resell bulk data, or represent model output as a government determination.</p>
      <h2>Not professional advice</h2>
      <p>CityLens provides screening signals and workflow tools. It is not a brokerage, appraisal, survey, title report, zoning opinion, legal opinion, environmental review, engineering report, or investment recommendation. Verify material facts with authoritative records and qualified professionals.</p>
      <h2>Data and model limitations</h2>
      <p>Public records, imagery observations, ownership data, zoning fields, capacity calculations, and model rankings may be incomplete, delayed, mismatched, or wrong. Priority tiers indicate relative model ranking and are not probabilities, guarantees of availability, or predictions that a parcel will transact or receive approvals.</p>
      <h2>Accounts and acceptable use</h2>
      <p>You are responsible for your account and API credentials. Do not upload secrets or sensitive personal information into notes. We may suspend access to protect the service, data subjects, or other users.</p>
      <h2>Pilot availability</h2>
      <p>The service is provided on an evaluation basis and may change. Paid scope, support, confidentiality, warranties, liability, and termination should be governed by a written pilot order.</p>
      <p>Questions: <a href="mailto:hello@citylens.dev">hello@citylens.dev</a>.</p>
    </article>
  );
}
