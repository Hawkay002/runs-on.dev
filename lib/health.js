// Classification for one claimed name, given the result of probing it. Pure:
// the script owns the network, this owns the meaning, so the meanings stay
// under test without a socket in sight.
//
// 'card'     No records: the wildcard serving the profile card IS the
//            intended state.
// 'redirect' A URL record: served by the app itself, DNS never points away.
// 'ok'       Records point at a provider and something that is not the
//            profile card answers.
// 'stuck'    Records point at a provider but the wildcard card still
//            answers — provider-side ownership verification has not
//            completed (the issue #26 class: the CNAME resolves, the probe
//            returns 200 with a certificate, and it is still the registry's
//            own page the visitor gets).
// 'down'     Records point at a provider and nothing answered the probe.
export function classifyClaim(claim, probe) {
  const records = claim.records ?? {};
  if (records.URL) return 'redirect';
  if (!records.CNAME && !(records.A ?? []).length) return 'card';
  if (!probe?.ok) return 'down';
  const host = `${claim.name}.runs-on.dev`;
  const answeredByCard = probe.finalHost === host && (probe.title ?? '').endsWith(`(${host})`);
  return answeredByCard ? 'stuck' : 'ok';
}
