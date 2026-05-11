# READ BEFORE BURNING

Pre-action checklist for the CV project. Each item below is here because forgetting it causes damage that's hard or impossible to recover from. Read the relevant section before doing the action it covers.

The full design is at `docs/superpowers/specs/2026-05-09-cv-design.md`. This file is the operational shortlist of the things you can get wrong silently.

---

## Before you set up `cameronhartman.dev`

**Set DNS records in this order. The order matters.**

1. **CAA first.** Add `cameronhartman.dev. CAA 0 issue "letsencrypt.org"` *before* asking GitHub Pages for a certificate. Pages uses Let's Encrypt; without the CAA record any CA could potentially issue a cert for your domain.
2. **Email lockdown next.** Even though we don't send mail, set these up *before* the domain resolves anywhere — otherwise there's a window where anyone can spoof `cameron@cameronhartman.dev` and pass SPF:
   - `cameronhartman.dev. TXT "v=spf1 -all"` — no one is authorized to send mail.
   - `_dmarc.cameronhartman.dev. TXT "v=DMARC1; p=reject; rua=mailto:cameron.hartman081@gmail.com"`
   - `cameronhartman.dev. MX 0 .` — RFC 7505 null MX, "this domain accepts no mail".
3. **CNAME last.** Only after the records above are live, point `cameronhartman.dev. CNAME cam-eeng.github.io.` and add a `CNAME` file at the repo root containing `cameronhartman.dev`.
4. **Registrar 2FA.** Hardware key. Not SMS. Not authenticator-app-only if you can avoid it. Domain takeover via registrar account compromise is the single highest-impact failure mode.
5. **Long renewal + auto-renew.** Multi-year, auto-renew on, payment method that doesn't expire.

## Before you migrate off GitHub Pages (someday)

**Reverse the order.** Remove the `CNAME` DNS record *first*, then change the repo. If you do it the other way, the DNS record points at GitHub Pages but the repo is gone — anyone who creates a Pages site claiming the same name takes over your domain. This is a real, documented attack pattern.

Same applies to subdomains: never create `blog.cameronhartman.dev` or similar pointing at Pages unless you're going to maintain it. Dangling subdomain CNAMEs are the same takeover attack.

## Before you write a GitHub Actions workflow

**Trigger rules — read every time.**

- Workflow with secrets ⇒ trigger is `push: [main]`, `schedule:`, or `workflow_dispatch`. Period.
- Workflow on `pull_request` ⇒ no secrets. Forks can run it; assume the fork is hostile.
- **Never** use `pull_request_target`. It's the trigger that runs in the PR's context with secrets available, and it's been the cause of many real-world supply-chain breaches.

The split is enforced in this repo by having `ci.yml` (PR, no secrets) separate from `deploy.yml` and `refresh-activity.yml` (main + cron, with secrets). Don't merge them.

**Pin third-party Actions to a 40-char commit SHA — and resolve the SHA from GitHub, not from memory.**

Pinning the SHA is what protects you from a compromised maintainer. But the rule only protects you if the SHA actually corresponds to the version comment next to it; a hand-written or hallucinated SHA either points at the wrong tree (silent supply-chain hole) or doesn't resolve at all (every deploy fails with `Unable to resolve action`).

Resolve every SHA at the moment you pin it:

```bash
gh api repos/<owner>/<action>/git/refs/tags/<version> --jq '.object.sha'

# example:
gh api repos/actions/deploy-pages/git/refs/tags/v5.0.0 --jq '.object.sha'
# → cd2ce8fcbc39b97be8ca5fce6e763baed58fa128
```

Paste the *resolved* SHA into the workflow with the version as an inline comment so future readers (and Dependabot) can cross-check:

```yaml
- uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5.0.0
```

When Dependabot bumps an Action, it does this lookup correctly — accept its diff verbatim. The risk is hand-edits and batch PRs where SHAs get typed in by a human (or an AI). If you (or I) ever combine multiple bumps into one PR, re-resolve every SHA with the command above before pushing. The first deploy after a wrong SHA is how you find out, and it can interrupt the site's auto-deploy chain.

Quick sanity-check after editing any `.github/workflows/*.yml`:

```bash
git diff --staged .github/workflows | grep -oE '@[a-f0-9]{40}' | sort -u | \
  while read sha; do
    sha="${sha#@}"
    gh api "repos/.../commits/$sha" >/dev/null 2>&1 && echo "$sha OK" || echo "$sha MISSING"
  done
```

(Replace `repos/.../commits/$sha` with the right `repos/<owner>/<action>/commits/$sha` per line if you want to be precise; the principle is "verify every pinned SHA resolves before merging.")

## Before you add a dependency

- It's going to ship JS that runs in every visitor's browser, with access to whatever's in `sessionStorage` (including BYOK keys).
- Check author / weekly downloads / maintenance signal before adding.
- After install, run `bun pm audit`.
- Prefer well-known packages over a clever-but-obscure one.
- Update `bun.lock` and commit.

## Before you accept a Dependabot PR

- Read the diff, especially for ecosystem-critical packages (`react`, `astro`, anything in `lib/ai/*`).
- Skim the upstream changelog/release notes.
- Don't auto-merge. The whole point of pinning is having a checkpoint.

## Before you add a new AI provider

The CSP allowlist must be updated *in the same PR*, or the provider's domain will be blocked at the browser and the feature will silently fail in production:

```
connect-src 'self' https://api.anthropic.com https://api.openai.com
            https://generativelanguage.googleapis.com
            https://openrouter.ai
            https://api.github.com
            https://<NEW-PROVIDER-HOST>;
```

The CSP lives in `src/layouts/Base.astro` (or wherever the meta tag ends up). There's a Vitest test that pins the allowlist — update that test in the same PR.

## Before you render AI output to the page

- Treat all AI output as untrusted input.
- Markdown gets rendered through DOMPurify with the strict allowlist in `src/lib/markdown/safe.ts`.
- **Never** `dangerouslySetInnerHTML` on AI output. **Never** pass it to `eval`, `new Function`, `setTimeout(string, ...)`, or anywhere a string becomes code.
- The CSP `connect-src` allowlist is the last-line defense if something does slip; don't relax it without thinking through what attacks it stops blocking.

## Before you commit

- `gitleaks` pre-commit hook should already block this, but: never commit `.env`, never commit a real API key, never commit a `bearer` token in a script.
- If you ever accidentally commit a secret: rotate the secret first, *then* deal with the git history. Removing it from history doesn't remove it from forks, mirrors, or anyone's local clone.
- `.env.example` only — real `.env` is gitignored.

## Before you log anything in CI

- Build logs are world-readable on a public repo.
- No `set -x` in shell scripts that touch secrets.
- Never `echo $TOKEN`. If a token has to be dynamic, use `::add-mask::` so it's redacted in logs.
- `refresh-activity.yml` should not log API responses — they sometimes contain user-identifying info or rate-limit headers that shouldn't be public.

## Before you rotate a PAT

- The cron workflow will fail when the old PAT expires. Set a calendar reminder for **80 days** after issuance — gives you 10 days of cushion.
- Rotation order: create new PAT (fine-grained, read-only on public data, 90-day expiry) → update the GitHub repo secret → manually trigger `refresh-activity.yml` to verify it works → revoke old PAT.
- Never extend an old PAT. Always create new.
- Same procedure for `HTB_API_TOKEN`.

## Before you archive the old `CAM-eEng/portfolio` repo

- Wait until `cameronhartman.dev` is live and stable.
- It's currently private and Pages is disabled — there's no live site to break.
- Archive (don't delete) — preserves git history, prevents new commits, signals "moved".
- Update the GitHub profile README and LinkedIn link to the new domain *before* archiving.

## Things that look like bugs but aren't

- **First chat message shows "cached: 0 tokens".** Expected. Prompt caching kicks in on the *second* request that uses the same prefix. The first request is what populates the cache.
- **Demo mode responses are pre-baked.** They're not coming from a model. The "stream" is artificial timing for UX consistency. This is intentional — the alternative is paying for inference Cameron's side or showing nothing.
- **Activity visualizer is one day stale.** It's regenerated nightly, not live. If you push a commit and it doesn't show up immediately, that's by design.
- **The CV chat won't answer questions outside `cv.yaml`.** The system prompt instructs the model to refuse off-topic questions and cite CV sections only. Adding more knowledge means editing `cv.yaml`, not changing the prompt.
- **`/oauth/callback` is a blank page for ~200ms.** It's exchanging the auth code, validating state, and scrubbing the URL via `history.replaceState`. The blank period is intentional — no analytics or trackers run before the URL is scrubbed.

## In case of emergency

- **Domain taken over:** contact the registrar, request emergency lock; if registrar account is also compromised, registrar's recovery process is your only option (this is why hardware-key 2FA matters).
- **Secret leaked:** rotate immediately, then audit access logs (GitHub repo audit log, provider's audit log if applicable). Assume it's been used.
- **Suspected supply-chain compromise:** lock the repo, revert to last known-good lockfile, audit the suspicious package, file an advisory if it's a real CVE.
- **CSP blocking a legitimate request in prod:** add the host to the allowlist (and the test) in a small PR; don't disable CSP.
