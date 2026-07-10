// Coffer — marketing landing page (single route).
// Faithful to the Coffer product design: Space Grotesk / JetBrains Mono,
// electric-blue accent, light dot-grid, editorial spacing. No waitlist.

const DIAMOND = (
  <span className="mark" aria-hidden />
);

/* ---- premium-decay chart geometry (exponential halving over 21 days) ---- */
function DecayChart() {
  const W = 560;
  const H = 200;
  const PAD = 10;
  const DAYS = 21;
  const NOW = 13;

  const x = (d: number) => PAD + (d / DAYS) * (W - 2 * PAD);
  // value halves each day: 1 → ~0; map to y (top = high price)
  const val = (d: number) => Math.pow(0.5, d);
  const y = (d: number) => PAD + (1 - val(d)) * (H - 2 * PAD);

  const pts = Array.from({ length: DAYS + 1 }, (_, d) => [x(d), y(d)]);
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(DAYS).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const nowX = x(NOW);
  const nowY = y(NOW);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Premium price decay curve, halving each day over 21 days">
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6bff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="#eef1f7" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#fill)" />
      <path d={line} fill="none" stroke="#2f6bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* "you are here" marker */}
      <line x1={nowX} x2={nowX} y1={nowY} y2={H - PAD} stroke="#2f6bff" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.5" />
      <circle cx={nowX} cy={nowY} r="6" fill="#fff" stroke="#2f6bff" strokeWidth="3" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* NAV */}
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top">
            {DIAMOND}
            <span>Coffer</span>
          </a>
          <nav className="nav-links">
            <a href="#premium">The premium</a>
            <a href="#how">How it works</a>
            <a href="#trust">Why it&rsquo;s safe</a>
          </nav>
          <div className="nav-cta">
            <span className="btn btn-soon" aria-disabled>
              <span className="dot" /> App coming soon
            </span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow reveal">◆ Expired&nbsp;.eth · in&nbsp;premium</span>
            <h1 className="reveal d1">
              Pool up to claim premium ENS names — <span className="em">together.</span>
            </h1>
            <p className="lede reveal d2">
              Browse names decaying through their 21-day temporary premium. Found one you love but too rich to grab
              solo? Start a pool, invite people through their on-chain records, and buy it with a multisig you all
              control.
            </p>
            <div className="hero-cta reveal d3">
              <a className="btn btn-primary" href="#how">
                See how it works
              </a>
              <a className="btn btn-ghost" href="#premium">
                What&rsquo;s the premium? →
              </a>
            </div>
            <div className="hero-stats reveal d4">
              <div className="stat">
                <div className="n">21 days</div>
                <div className="l">Dutch-auction window</div>
              </div>
              <div className="stat">
                <div className="n">~50%</div>
                <div className="l">Price drop per day</div>
              </div>
              <div className="stat">
                <div className="n">2–20</div>
                <div className="l">People per pool</div>
              </div>
            </div>
          </div>

          {/* floating live-style name card */}
          <div className="reveal d3">
            <div className="namecard float">
              <div className="nc-top">
                <span className="tag tag-premium">Premium</span>
                <span className="live">
                  <span className="dot" /> live auction
                </span>
              </div>
              <div className="nc-name">
                defi<span className="eth">.eth</span>
              </div>
              <div className="nc-meta">4 letters · expired 13d ago</div>
              <div className="nc-rows">
                <div className="nc-row">
                  <span className="k">Current premium</span>
                  <span className="v big">$12,240</span>
                </div>
                <div className="nc-row">
                  <span className="k">Falling</span>
                  <span className="v drop">↓ 50% / day</span>
                </div>
                <div className="nc-row">
                  <span className="k">Hits $0 in</span>
                  <span className="v">8d 22h</span>
                </div>
              </div>
              <div className="nc-progress">
                <div className="bar">
                  <div className="fill" />
                </div>
                <div className="label">
                  <span>7.98 / 12.4 ETH pooled</span>
                  <span>3 pools forming</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREMIUM EXPLAINER */}
      <section className="band band-alt" id="premium">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">The temporary premium</span>
            <h2>When a name expires, its price falls every single day.</h2>
            <p>
              An expired .eth name enters a 21-day Dutch auction. The premium starts near $100M and decays to $0, added
              on top of the standard fee. Waiting drops the price — but anyone can register the instant it fits their
              budget, so timing is the whole game.
            </p>
          </div>

          <div className="premium-grid">
            <div className="chart">
              <div className="chart-head">
                <span className="t">Premium price decay</span>
                <span className="now">NOW · DAY 13</span>
              </div>
              <DecayChart />
              <div className="axis">
                <span>Day 0</span>
                <span>Day 7</span>
                <span>Day 14</span>
                <span>Day 21</span>
              </div>
            </div>

            <div className="facts">
              <div className="fact">
                <span className="ico" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h4>It halves daily</h4>
                  <p>A name too expensive today can be affordable in a week — the curve does the work while you decide.</p>
                </div>
              </div>
              <div className="fact">
                <span className="ico" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h4>Timing is the game</h4>
                  <p>Anyone can register the moment it fits their budget. A ready pool grabs the name before someone else does.</p>
                </div>
              </div>
              <div className="fact">
                <span className="ico" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.5 12l1.8 1.8 3.5-3.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h4>The controller refunds overpay</h4>
                  <p>Register with a small buffer for price drift — ENS returns anything you overpay automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="band" id="how">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>From &ldquo;we want defi.eth&rdquo; to a Safe that owns it.</h2>
            <p>Four steps, entirely in the app — no CLI, no Etherscan, no single point of trust.</p>
          </div>

          <div className="steps">
            <div className="step">
              <span className="arrow" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="num" />
              <h3>Discover a name</h3>
              <p>Browse names in premium, watch the price fall, and pick one worth pooling for.</p>
            </div>
            <div className="step">
              <span className="arrow" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="num" />
              <h3>Start a pool &amp; invite</h3>
              <p>Set the target and invite people by ENS name — we reach them through their on-chain email or Telegram record.</p>
            </div>
            <div className="step">
              <span className="arrow" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="num" />
              <h3>Fund the escrow</h3>
              <p>Everyone deposits into an audited escrow. Change your mind before the buy? Withdraw in full, no permission needed.</p>
            </div>
            <div className="step">
              <span className="num" />
              <h3>Execute together</h3>
              <p>At target, the pool deploys a Safe owned by every contributor, which registers and holds the name.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="band band-alt" id="trust">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Why it&rsquo;s safe</span>
            <h2>No one can drain the funds or abscond with the domain.</h2>
            <p>The whole point of pooling with strangers-you-trust is that the rules live in a contract, not in a promise.</p>
          </div>

          <div className="pillars">
            <div className="pillar">
              <span className="ico" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h3>A multisig you all control</h3>
                <p>On success the pool deploys a Safe owned by every contributor. No single member can move the funds or the name alone.</p>
              </div>
            </div>
            <div className="pillar">
              <span className="ico" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 019-9 9 9 0 016.4 2.6L21 8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12a9 9 0 01-15.4 6.4L3 16" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h3>Unilateral refunds</h3>
                <p>Any contributor can exit with a full refund, without anyone else&rsquo;s permission, any time before the execution lock.</p>
              </div>
            </div>
            <div className="pillar">
              <span className="ico" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h3>Ownership from the chain</h3>
                <p>Your share is exactly your deposit ÷ the target — reconstructable from on-chain events alone, never from a database.</p>
              </div>
            </div>
            <div className="pillar">
              <span className="ico" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h3>Audited escrow, standard Safe</h3>
                <p>The only custom code holding funds is one small escrow contract, shipped audited. Safe and ENS are used exactly as deployed.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="wrap closing">
        <div className="closing-inner">
          <h2>Premium names shouldn&rsquo;t only go to whoever&rsquo;s richest.</h2>
          <p>Coffer turns a name that&rsquo;s out of reach solo into one a group can own — together, and provably fair.</p>
          <div className="closing-cta">
            <span className="btn btn-light" style={{ cursor: "default" }}>
              Launching soon
            </span>
            <a className="btn btn-outline-light" href="#how">
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="brand" href="#top" style={{ fontSize: 17 }}>
            {DIAMOND}
            <span>Coffer</span>
          </a>
          <nav className="footer-links">
            <a href="#premium">The premium</a>
            <a href="#how">How it works</a>
            <a href="#trust">Safety</a>
          </nav>
          <span className="fine">Pool ETH · buy premium ENS · own it together</span>
        </div>
      </footer>
    </>
  );
}
