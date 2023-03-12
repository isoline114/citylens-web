export const metadata = { title: 'Privacy — CityLens' };

export default function PrivacyPage() {
  return (
    <main className="prose prose-slate mx-auto max-w-3xl py-8">
      <h1>Privacy notice</h1>
      <p><strong>Effective July 24, 2026.</strong> This notice describes the CityLens pilot product.</p>
      <h2>Information we process</h2>
      <p>We process account identifiers, authentication events, API usage, saved parcel workflow records, saved searches, support messages, pilot-request contact and workflow information, and coarse product analytics. Notes and tags are user-provided and should not contain sensitive personal information.</p>
      <p>For Parcel Intelligence adoption measurement, we keep bounded daily counts of coarse actions and where they began, such as opening a parcel from the map or saving a lead. These counters do not include parcel IDs, addresses, owners, page URLs, notes, tags, assignees, contacts, or other free text. They are automatically scheduled for deletion after no more than 90 days.</p>
      <p>Our pageview analytics are configured to remove URL query parameters and fragments before collection. This prevents parcel-selection parameters, including BBL query values, from being sent with pageview URLs.</p>
      <h2>Why we process it</h2>
      <p>We use this information to provide and secure the service, enforce quotas, synchronize acquisition workflow, diagnose failures, improve ranking and product experience, and communicate about a requested pilot.</p>
      <h2>Public property information</h2>
      <p>Parcel, ownership, deed, zoning, permit, and imagery-derived information is assembled primarily from public government records and licensed or public imagery sources. Public-source information can be incomplete or outdated.</p>
      <h2>Sharing and retention</h2>
      <p>We use infrastructure and authentication providers to operate CityLens. We do not sell account information. Aggregate Parcel Intelligence adoption counters expire after no more than 90 days. Pilot requests are scheduled to expire after no more than 365 days unless they become part of a customer relationship or must be retained for legal or security reasons. Account, security, support, and user-created workflow records may be retained longer as needed to provide the pilot and meet legal or security obligations.</p>
      <h2>Your choices</h2>
      <p>Contact <a href="mailto:hello@citylens.dev">hello@citylens.dev</a> to request access, correction, export, or deletion of your account data. Some security and legal records may need to be retained.</p>
    </main>
  );
}
