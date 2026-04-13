# Product Marketing Context — Cables

*Last updated: 2026-04-13*

**Relationship to FRE|Nxt Labs:** Cables is a content + tooling initiative of [FRE|Nxt Labs](https://frenxt.com). The parent brand's marketing context lives in the `frenxt` repo at `.agents/product-marketing-context.md`. This document is scoped to Cables as a standalone product and should be used when working inside this repo.

## Product Overview

**One-liner:** A wire service for people shipping with AI. Dispatches from the field, artifacts you can install.

**What it does:** Cables is a dated, sourced, first-person library of dispatches from engineers actively shipping with Claude Code — and the real artifacts (CLAUDE.md templates, skills, subagents, slash commands) you can drop into your own project with one command: `npx frenxt add <slug>`. Reads like a working chat log between peers, not a marketing site. Starts with Claude Code, architected to expand to other AI coding tools.

**Product category:** *Wire service for AI builders.* No clean existing shelf. Alternatives are awesome-lists (static link dumps, stale), shadcn/ui (same distribution pattern but different content category), Anthropic docs (authoritative but no practitioner angle), AI influencer threads (timely but undated and unsourced). The category name is part of the positioning — we're creating a new shelf.

**Product type:** Open-source content hub (MIT) + `frenxt` CLI (npm) + rendered website.
- Content repo: `github.com/frenxt/cables` (public)
- CLI package: `frenxt` on npm, published from `packages/cli/` in the same repo
- Site: `frenxt.com/cables/` at launch, future home at `cables.sh` once the domain is purchased

**Business model:** Free forever, MIT-licensed, no paid tier. Monetization is indirect via founder brand and inbound demand to FRE|Nxt services.

## Target Audience

**Dual primary personas** (both weighted equally):

### The Shipping Engineer
An indie developer or small-team engineer (1–20 people) already using Claude Code to ship real features. 3–10 years of engineering experience. Comfortable in a terminal. Has opinions about their CLAUDE.md file. Doesn't trust influencer threads. Writes TypeScript, Python, Go, or Rust. Might be a startup founder, a staff engineer at a small team, or a freelancer.

**Primary use case:** *"I have Claude Code installed and I'm not sure if I'm using it well. Show me what working setups actually look like, and give me the files to copy."*

### The AI-Adopting Founder
Technical founder or founding engineer at a 2–50 person startup thinking about *leverage* — how to get 2–5× output from their engineering team using AI tools as compounding infrastructure, not one-off tricks. Already using Claude Code personally; now trying to figure out how to make it a team practice.

**Primary use case:** *"Show me what an AI-native engineering practice looks like at small team scale. Patterns I can introduce to the team, not just things I do alone."*

**Not the audience:**
- AI-curious managers who haven't installed Claude Code
- Enterprise architects writing vendor reports
- "AI influencers" sourcing content for threads
- Beginners without hands-on tool experience
- People who want hand-holding tutorials

**Shared decisive trait across both personas:** They are *doing the work*, not *watching it*. Neither wants to be taught. Both want to see what peers are doing and steal the good parts.

**Jobs to be done:**

1. *"Show me what a good setup actually looks like."* (Day 1→N track, shared)
2. *"Give me a `<skill | CLAUDE.md | subagent | slash command>` I can steal."* (Catalog + CLI, shared)
3. *"Tell me what broke so I don't repeat the mistake."* (War story voice, shared)
4. *"Show me patterns that scale beyond solo usage."* (Founder-specific, implies `team-setup` / `leverage-patterns` categories)
5. *"How are other small teams actually structuring their AI workflow?"* (Founder-specific)

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| **Shipping Engineer** (primary) | Ship this week, steal good patterns, not look dumb | Scattered Claude Code content — marketing fluff or stale tweets | Short, dated, first-person dispatches with one-command installs |
| **AI-Adopting Founder** (primary) | Team leverage, scaling AI-native practice, compounding engineering | No one's written down what good looks like at small team scale | Battle-tested team patterns from peer founders and shipping engineers |

## Problems & Pain Points

**Core problem:** The Claude Code ecosystem is young, fast-moving, and fragmented. The best knowledge lives in people's heads and private repos. What's publicly available is either:

- **Official docs** — accurate but generic. Doesn't tell you which approach is best, doesn't cover "what actually worked for us."
- **Twitter threads** — timely but shallow, often undated, sometimes wrong.
- **Awesome-lists** — broad but stale. Link dumps with no narrative, no voice, no installable artifacts.
- **Individual blog posts** — deep but one-off. Unsourced, quickly outdated, not curated.

**Why alternatives fall short:**
- Static link dumps rot in weeks — AI tools change faster than curation
- Tweet-length "here's my setup" posts leave out the failure modes
- Official docs don't have opinions and can't tell you what scales
- No single source of truth for "what real engineers are actually doing *right now*"

**What it costs them:**
- Hours of trial-and-error per new capability
- Imposter syndrome ("am I doing this right?")
- Quiet stagnation — the discovery cost is so high people stop exploring

**Emotional tension:**
> *"I'm supposed to be the AI expert on my team. But honestly, I'm not sure my CLAUDE.md isn't stupid, and I'm too embarrassed to ask. I see people on Twitter posting workflows that make mine look primitive. I don't have time to read 40 blog posts."*

## Competitive Landscape

**Direct — other Claude Code community resources:**
- `awesome-claude-code` and variants — static link dumps, no voice, no installable artifacts, stale within weeks.
- `claudelog.com`, personal blogs — individual voice but not curated or searchable at scale.
- **Fall short because:** no distribution mechanism, no freshness guarantee, no consistent editorial bar.

**Secondary — shadcn-style registries for adjacent categories:**
- shadcn/ui — the distribution pattern cables borrows, but the content category is UI components, not AI coding workflows.
- **Falls short because:** cables is an entirely different shelf; no overlap in content or audience.

**Indirect — official authorities and AI influencer content:**
- Anthropic docs — the source of truth for what Claude Code *can* do. Doesn't cover what actually worked or broke.
- Twitter/X AI influencers — timely, entertaining, undated, usually marketing-flavored.
- Courses and paid content — higher commitment, slower to update.
- **Fall short because:** none provide "dated, sourced, first-person dispatches with installable artifacts."

## Differentiation

**Key differentiators:**

1. **Installable artifacts** — not just advice, but the actual file(s) you can drop into your project. One command: `npx frenxt add <slug>`.
2. **First-person plural voice** — "we tried this and it broke" — practitioner, not marketer.
3. **Date-stamped freshness** — every cable has a `last_verified` field, surfaced as a green/amber/red pill. Stale content is visibly stale, not hidden.
4. **Sourced claims** — every behavioral claim about Claude Code links to official docs, a commit, or a dated blog post. No vibes.
5. **Curated, not dumped** — every PR is reviewed for voice, accuracy, and duplication. Not every contribution is accepted.
6. **Named contributors** — every cable has a prominent contributor byline; aggregated `by/<contributor>` pages; OG social cards feature the author. Contributors get individual credit, which supports the founder-brand goal.

**How we do it differently:** The combination of a living GitHub repo + strict house voice + shadcn-style installer + named-contributor surfacing is novel. Awesome-lists have community but no voice or distribution. shadcn has distribution but different content. Anthropic has authority but not the practitioner angle. AI influencers have reach but no permanence.

**Why customers choose us:** One copy-paste install saves an afternoon, and you trust it because the cable tells you what actually happened on a real project and when it was last verified.

## Objections

| Objection | Response |
|---|---|
| *"Another awesome-list I'll bookmark and forget."* | Every cable ships an installable artifact — the CLI makes it usable, not just readable. Every cable has a `last_verified` date; stale ones are visibly stale. |
| *"Why should I trust random contributors?"* | Strict editorial review enforced by PR template. Reviewers reject on voice, accuracy, and sources. Not an open dump. |
| *"Won't this be stale in three months?"* | `last_verified` surfaces age. Monthly cron opens issues on cables older than 90 days. Stale entries get flagged, not hidden. |
| *"I can figure this out myself."* | Sure, in a few hours per topic. Cables is the concentrated version — 5 minutes per cable, pre-verified by peers. |
| *"How is this different from reading the docs?"* | Docs tell you what the tool *can* do. Cables tells you what actually worked on a real project, including what broke. |
| *"Will installing random files break my project?"* | CLI shows a diff preview before writing. Default is `prompt` on conflict — never silent overwrite. `--dry-run` lets you see what would happen. |

**Anti-persona:**
- People who want to *read about* AI tools without using them
- Managers looking for vendor justifications
- Enterprise architects writing comparison docs
- "AI influencers" sourcing content for threads
- Beginners who haven't installed Claude Code (redirect them to official docs — we don't serve this persona)

## Switching Dynamics (JTBD Four Forces)

**Push** (what drives them away from current solutions):
- Scattered, undated, unsourced Claude Code content on Twitter/Reddit/Medium
- Imposter syndrome about their own setup
- The cost of evaluating every new capability from scratch
- Realization that bookmarked Twitter threads are a graveyard

**Pull** (what attracts them to cables):
- Short, dated, sourced, first-person dispatches
- Installable artifacts with one command
- A known editorial bar
- A living resource that gets better over time
- Named contributors who feel like peers, not influencers

**Habit** (what keeps them stuck):
- Bookmarking Twitter threads they'll never revisit
- Following official docs (comprehensive but opinion-free)
- The vague belief that they'll "write down their own setup someday"
- Sharing Slack links with teammates that go stale

**Anxiety** (what worries them about switching):
- *"Will installing random files break my project?"* (addressed by dry-run + prompt-on-conflict)
- *"Is this just another marketing-funnel content farm?"* (addressed by MIT license + open PRs + no paywall)
- *"Will it still be here in six months?"* (addressed by live repo + contributor count + public star history)

## Customer Language

**How they describe the problem:**
- *"I don't know if my CLAUDE.md is any good."*
- *"There's too much Claude Code content and none of it tells me what actually works."*
- *"I need a `<skill | subagent | hook>` for X — I know someone's already built this."*
- *"Every blog post is six months old and the tool's changed three times since."*
- *"How are people actually structuring this at a real company?"* (founder)
- *"I want to get my team on the same AI patterns I'm using solo."* (founder)

**How they describe cables (target phrases):**
- *"The place I go when I need a `<thing>` for Claude Code."*
- *"Like awesome-claude-code but you can actually install the stuff."*
- *"Short dispatches from people who actually ship."*
- *"I grab my CLAUDE.mds from cables now."*
- *"Their `leverage-patterns` track is how we rolled Claude Code out to our team."* (founder)

**Words to use:** dispatch, field notes, shipped, verified, installable, practitioner, dated, sourced, last verified, war story, copy, drop in, paste, leverage, compound, pattern.

**Words to avoid:** curated (overused), awesome (saturated), ultimate (marketing cliché), "learn" (condescending), "master" (ditto), revolutionary, game-changing, AI-powered, next-generation, any verb that reads like a SaaS landing page ("unlock," "supercharge," "transform").

**Glossary:**

| Term | Meaning |
|---|---|
| Cable | A single dispatch entry. "Day 2 is a cable about CLAUDE.md." |
| Dispatch | Synonym for cable when "cable" reads ambiguously. |
| Track | A sequenced set of cables (e.g., `fundamentals`, `leverage-patterns`). |
| Catalog | The filterable browse view of all cables. |
| Registry | The installable-artifacts layer — the CLI side. |
| Last verified | The date a cable's claims were last re-checked by a maintainer. |
| War story | A FRE|Nxt field note, inline in a cable body. |
| `frenxt` | The CLI binary that installs artifacts: `npx frenxt add <slug>`. |

## Brand Voice

**Tone:** Candid, practitioner, dry. Confident without cocky. Never hypey. Closer to a working chat log between peers than a marketing site.

**Style:** First person plural, past tense, concrete. Short paragraphs. Leads with a moment, not a definition. Claims always linked. Honest about failures.

**Personality (3 adjectives):** **Candid. Practitioner. Dated.**

- **Candid** because we say what broke, not just what worked.
- **Practitioner** because every word is written by someone who actually did the thing.
- **Dated** because freshness is a feature, not an apology — every cable wears its last-verified date like a badge.

**Voice resolution note (we vs. named contributor):** `we` in the cable body means "the cables community and the FRE|Nxt team." Individual credit is given via the prominent `contributors` byline on every cable, the `by/<contributor>` pages, and OG social cards that feature the author. This means the voice stays collective while the attribution stays individual — supporting both the house voice and the founder-brand goal without conflict.

## Proof Points

**Metrics to build toward (not yet live):**

| Metric | Category |
|---|---|
| GitHub stars on `frenxt/cables` | Platform traction |
| Total installable artifacts in the catalog | Product breadth |
| External contributor PRs merged per month | Community health |
| Named contributors with 3+ cables | Founder-brand density |
| % of cables with `last_verified` under 30 days | Freshness quality |
| `install_command_copied` events per month | Utility signal |
| Site sessions referred to FRE|Nxt services pages | Business value |
| Social shares per cable (LinkedIn, Twitter, HN) | Distribution reach |

**Value themes (messaging pillars):**

| Theme | Proof |
|---|---|
| Dated, not stale | Every cable shows `last_verified`; monthly stale-content cron flags anything over 90 days |
| Installable, not just readable | `npx frenxt add <slug>` drops real files into your project |
| Practitioner, not marketing | First-person-plural voice, PR review rejects hype |
| Sourced, not vibes | Every behavioral claim links to a dated source |
| Named, not anonymous | Every cable has a prominent contributor byline and author page |

## Goals

**Primary business goals** (both weighted equally):

1. **Founder brand.** Position the founders of FRE|Nxt Labs (and named contributors) as the practitioner authority on shipping with AI coding tools. Every cable has a prominent contributor byline, aggregated `by/<contributor>` pages, and social OG cards that feature the author + last-verified date. Every share is distribution for the author, not just the platform.

2. **Best collection of AI ecosystem artifacts, one-click usable.** Cables should be the single most comprehensive and installable registry of Claude Code (and over time, all AI coding tool) artifacts. Moat = editorial bar × artifact count × freshness × install UX.

**Supporting goal:**

3. **Qualified inbound to FRE|Nxt services.** Cables is the top-of-funnel content engine that seeds awareness for the consultancy. Trailing metric, not primary.

**Primary conversion actions:**

- **`install_command_copied`** — "did this cable earn its keep as a registry item"
- **Outbound social share** from a cable page — "did this cable amplify the founder brand"
- **Click-through to FRE|Nxt services / case studies** — "did this cable seed inbound demand"

**Month 1 targets:**

| Target | Why it matters |
|---|---|
| 100 GitHub stars on `frenxt/cables` | Platform traction signal |
| 3 merged external contributor PRs | Open-source flywheel proof |
| 50 `install_command_copied` events | Utility signal — are people actually installing? |
| 200 organic search sessions to `/cables/*` | Top-of-funnel reach |
| First named contributor page live with 5+ cables | Founder-brand density |
| 10+ referral clicks to FRE|Nxt services | Business value signal |
| Domain `cables.sh` registered (even if not pointed) | Brand protection |

## Domain Strategy

- **Current home:** `frenxt.com/cables/` (site), `github.com/frenxt/cables` (repo).
- **Future home:** `cables.sh` — available, ~$80/yr, deferred on budget.
- **Strong recommendation:** register `cables.sh` soon (even without pointing DNS) to prevent squatting. If someone else grabs it, the metaphor collapses.
- **Architecture requirement:** do not hard-code `frenxt.com` in MDX links or CLI output. Use relative URLs or a single config constant. This makes the future cutover from `frenxt.com/cables` → `cables.sh` a one-line change.
