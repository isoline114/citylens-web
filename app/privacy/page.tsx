export const metadata = { title: 'Privacy — CityLens' };

export default function PrivacyPage() {
  return (
    <main className="prose prose-slate mx-auto max-w-3xl py-8">
      <h1>Privacy notice</h1>
      <p><strong>Effective July 17, 2026.</strong> This notice describes the CityLens pilot product.</p>
      <h2>Information we process</h2>
      <p>We process account identifiers, authentication events, API usage, saved parcel workflow records, saved searches, support messages, and coarse product analytics. Notes and tags are user-provided and should not contain sensitive personal information.</p>
      <h2>Why we process it</h2>
      <p>We use this information to provide and secure the service, enforce quotas, synchronize acquisition workflow, diagnose failures, improve ranking and product experience, and communicate about a requested pilot.</p>
      <h2>Public property information</h2>
      <p>Parcel, ownership, deed, zoning, permit, and imagery-derived information is assembled primarily from public government records and licensed or public imagery sources. Public-source information can be incomplete or outdated.</p>
      <h2>Sharing and retention</h2>
      <p>We use infrastructure and authentication providers to operate CityLens. We do not sell account information. We retain records for as long as needed to provide the pilot, meet security and legal obligations, and improve the service.</p>
      <h2>Your choices</h2>
      <p>Contact <a href="mailto:hello@citylens.dev">hello@citylens.dev</a> to request access, correction, export, or deletion of your account data. Some security and legal records may need to be retained.</p>
    </main>
  );
}
