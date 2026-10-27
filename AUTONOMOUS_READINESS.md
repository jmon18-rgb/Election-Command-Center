# Election Night production-readiness assignment

## October26 23:56Z — Maine real same-office baseline and strict county adapter implemented

- Followed actual official previous-election/2020page links to ussenator1120.xlsx,
  downloaded44,469bytes,SHA0880031fa74d62dbbaf2e6a40380b7a3801033e66fcf8634b2e6f4b3e3fb96ce.
  Exactofficialsheet/headers/partyrows verified. Reproducible importer joins16county
  codes to existing independently pinnedCensusGazetteer23xxxIDs, verifies everytown
  andsubtotal/state. Officialcounty sums plus SEPARATE statewideUOCAVA reconcile
  exactly347223D/417645R. UOCAVA4068D/1089R staysunallocated; no fakecountyassignment.
- New pinnedoriginalworkbook,16countybaseline/reference, importer/tests. Blankballots
  excludedfromcontestvotes but preserved, thirdpartyvotes retained. Finalfirstchoice
  history is NOT reportingchronology, calibration or2026ballotsoutstanding.
- New strict Maine source adapter: select ONLY16Countyaggregates outofmixedCounty/
  Township payload, exactindependentFIPS/names andballotverifiedcandidateIDs; never
  doublecounttowns. Explicitround1only, stale/test/preclose/candidate/totalguards;
  reject additionalcandidate/writein orround2 untilreviewed. Providerstate totals
  mustexactlyreconcilecounty totals; anyunallocatedpositive2026componentcurrently
  excludes source rather than inventingitsgeography. No winnerflagforecastinput.
- LocaltestsPASS originalbaseline/UOCAVA/subtotals and meaningfulsyntheticpositive
  source cases: nestedtown999999999counts ignored; duplicate/missingcounty, round2,
  alteredcandidateID, totalsdisagreement/stalereply rejected. Newread-onlyCIworkflow
  runs bothcontracts. NoUI/controller/nationalactivation yet: this is implemented
  preparation for a TENTH nationalinput, not actualpositiveMaineforecasting.
- NEXT: finishreviewchecks, then connectMaine to existingnationalcontroller/likelihood
  with explicitfirstchoice/unallocateduncertainty and sameexistingcadencebudget;
  testnationalmovement/corrections beforedeployment. No newracepanel. Keep all
  existing9inputs operational and source/calibration limits visible.


## October26 23:41Z — Maine independent ballot contract verified

- OfficialWestbrookElections&Voting page actually links sampleballot6376. Original
  PDF downloaded200,SHA668442884edfa5d196d0013dc3a185028d7a668874eac630bbc7f27cdbaa33dc.
  ReadonlyPDFskill render/visualQA bothpages confirmsNov3,2026/style287/WestbrookW1.
  Senatepage2:Collins,SusanM.Republican/Jackson,TroyD.Democratic pluswrite-in,
  three rankcolumns. This independently matches currentprovider namedcandidateIDs
 220470/220471; no reliance on conflicting searchsnippets or primarycandidate lists.
- data/close_senate_source_assessment.json now pins exactofficiallink/hash/page/
  aliases. OriginalPDF and renderedpages saved maine-source-research. Candidate
  identity blocker resolved; ranked-choice/write-in semantics remain explicit.
- NEXT implement16countyfirstchoice baseline/strictmixedgeography adapter using
  independentCensuscountyIDs and actualofficial2020Senatecountyexport. Official
  previous-election landing indexed countyXLS exports; retrieve actualpublished
  link via independently linked state/municipalarchive, no inventedURL. Firstchoice
  remaining-vote likelihood can inform experimentalnationaloutlook under owner's
  assumption; never declare finalRCVwinner from initialround alone.
- MainCI/openPRshealthy/unchanged; no additional nationalinput enabled yet.


## October26 23:26Z — actual close-Senate feasibility separates MEmunicipal from AKstate-only

- Existing approved civic routesME87188/AK86916 inspected in ordinary deployed-site
  browser CORS, both200/non-test/stalezero/round1. Python403 is not browserfailure.
  Saved originalresponses and hashes, no fixtures or actualpositiveforecast claim.
- ME has534mixed rows:518Township PLUS16County aggregates, Collins220470/Jackson220471.
  Exact independently verified ballot and same-round COUNTYhistorical baseline
  required. OfficialSOS RCV/sample-ballot page403 in ordinaryEdge too; don't retry
  unchanged or silently replace with searchsnippet candidates. RCVround1 not final.
- AK exposes only1State row and6candidates including multipleRepublicans and two
  distinctSullivans; insufficientregionalremaining-vote evidence and no independent
  finalballot/transfer contract. Do NOT sum allRepublican primary-looking names or
  treat state totals as a geographical partial-return forecast. NoAKcustomadapter
  work until source supplies supportedresolution/identity.
- data/close_senate_source_assessment.json records exactrows/types/IDs/blockers;
  actualzero/noenable assertionspass. Existing statewide results adapters remain
  intact; no additional nationalinput or customracepanel enabled.
- NEXT: ME official sample ballot via an independently linked municipalgovernment
  posting, then independently match16county aggregates and first-choice countyhistory. Never
  sum counties plus towns. Existing broad
  provider remains fallback. Do not divert back into optionalAZgeography while
  primarySenatecontract remains unresolved. Allcurrentmaincheckshealthy.


## October26 23:11Z — owner approved narrower predictive scope and national co-movement assumption

- Latest HUMAN instruction supersedes broader expansion: custom predictive work
  only close Senate and uploaded Silver House power-flip races. Safe seats retain
  broad providers; no custom prediction work, new panels or polish. Owner accepts
  using pivotal performance as evidence of broader direction, with uncertainty.
  This is an assumed shared national component, not newly demonstrated calibration;
  preserve existing correlated model/bounded likelihood rather than average odds
  or uniformly transfer a single candidate's Senate surprise to allHouse.
- Captured actual deployed linked503race model once (no syntheticreturns). Internal
  data/predictive_development_scope.json sets a bounded work queue: primary Senate
  IA/KS/AK/ME/TX in35-65band; near-boundaryMI/NE/OH/SC review if25-75andpollmargin<=5.
  House limited first10existing uploaded screenshot seed rows if25-75:PA10/NC01/
  AZ06/NY17/VA02/PA07/AZ01/PA08/WI03/MI07. Seed order is NOT Silver probabilities.
  Bands bound engineering effort, not race calls; near-boundary review avoids
  declaring a seat safe from a onepoint threshold. Existing9inputs preserved.
- Local queue assertions exclude safeNC-SEN/governors/customsafe-seatwork and
  capHouse10; source snapshot/hashes and captured model timestamps retained.
  Missing primarySenateME/AK now precedes further optionalAZ01geography work.
- BoundedME feasibility lead: officialSOS Sept4process update says election-night
  returns come from municipalities, clerks have2days to submit toSOS; federal
  Senate usesRCV. Officialresults landing currently lists primary results, not
  a verified fastgeneralfeed. Firstchoice totals cannot be finalRCVresults.
  https://www3.maine.gov/sos/news/general-election-two-months-away-secretary-states-office-provides-update-maine-election-1
  https://www.maine.gov/sos/elections-voting/election-results-data
  Next verify exactofficialballot/candidate identity and a permittedmunicipal/
  broadprovider path before adapter work; no claimMEsourceisready.
- AZ01originalhistoricaltotals resolved as recorded22:56; precinctequivalency remains
  blocked. Do not spend runs perfecting geography ahead of primary Senate gaps.
  MainPages/CIhealthy/openPRsunchanged. No newliveinput/calibration claim.


## October26 22:56Z — AZ01 historical vote-total blocker resolved from original export

- Actual OpenElections SOURCES repository2024/general lists original county-format
  MaricopaTXT34,877,349bytes, SHA49e9bb23f7cdd510802a04edf7798c45f6753a7c0e82478843e60fe49e1f7a54.
  Downloaded original, exactCD1unique-precinct totals208966D/225538R/786writeins,
  matching independent existing major-party reference exactly. No invented fixes.
- ProcessedCSV discrepancy localized to7specificcandidate/precinct cells: original
  counts1to7became0inprocessedCSV, totaling5D/25R. Original also restores correct
  Shah/Schweikert spellings. Use original, not processedCSV, for future baseline.
- Old0565NVP19/0566NVP2 have0registered/0votes; blanksummaryrows also0. This
  narrows geography issue but does NOT prove where new0944COSMOS/0948HEATHERBRAE/
 0953MAYA came from or that207commonprecinct IDs retain identical boundaries.
  Full209historicalprecincts still not mapped to210current; no baseline approval.
- Recorded exact original source/cells in assessment, local assertionspass,
  originalTXT/selectedrows/celldiff saved. No deniedcountyarchive retry. NEXT
  independently verify official2024/2026precinct shapes/equivalency and partition
  history without guessing; source-clock/live semantics still outstanding.
  Nationalinputscopeunchanged; no calibration or postclose delivery claim.


## October26 22:41Z — alternative AZ01 history found; exact reconciliation gaps measured

- Used primary OpenElections repository contents API (not guessedfile) to find actual
 2024GeneralMaricopa precinctCSV8,236,560bytes, SHAd338c70e939df068e85c80fe7800732462a2673b09fbc128755c8bca6c486a8a.
  ExactofficeU.S.House/districtCD-1: DEM208961/REP225513. Must exclude
  TotalVotes/UnderVote/OverVote rows; raw processed candidate spellings have errors.
- Existing independently pinned district reference DEM208966/REP225538 differs
  by5D/25R. No baseline approved or silent total adjustment. Processed source has
 209precincts, current official2026template210:207IDscommon; historicalonly0565/0566,
  currentonly0944/0948/0953. Unchangeddistrictboundary does NOT mean precincts
  unchanged. Do not apportion the two old precincts over three new ones by guess.
- Source assessment records exact totals, omitted noncandidate rows and explicit
  fail-closed baseline decision; local assertions pass. ActualCSV/joinreport saved.
  No deniedcountyarchive retry, no calibration/predictiveinput claim.
- NEXT: inspect processed source's original provenance/county export and official
  precinct equivalency for five changed IDs. Need both total reconciliation and
  geography agreement; until then maintain existing9routes. MainCIhealthy/openPRs
  unchanged. This is actionable engineering evidence, not a production milestone.


## October26 22:26Z — AZ01 archive investigation bounded and stopped

- Actual archive-page declared scripts inspected once. File-list application is
  mes-app-bundle~2026-09-17-18-21-26-696~cache.js; ordinary browser request403.
  This explains an inaccessible script dependency, not proof no2024export exists.
  A bounded independent primary-source search did not locate a replacement export.
- Source assessment records exact script URL/status and no-retry boundary. No
  guessedassetIDs, access bypass, invented precinct allocation or baseline promotion.
  Current actual2026county template remains saved; no reason to redownload31MB.
- NEXT source work must use a new independently linked2024precinct export or an
  existing licensed/processed source with original provenance and reconciliation,
  rather than revisit this unchanged archive route. Keep AZ01activation blocked
  pending210precinct crosswalk/baseline and reporting semantics. No national scope
  change or user action required. Current openPRs unchanged; mainPageshealthy.


## October26 22:14Z — PR466 source-audit review deployed; live-input scope unchanged

- ALL3 exact-head workflows success at6ab9cf4fbdf29611738bb247d8ef87cabed96c3d;
 6latestchecks5success/1nonapplicable deployedskip, no external statuses,
  exacthead/mergeableclean verified. Authorized merge56f97c35d42570650532c14fdb3b7e791c68ca37.
  https://github.com/jmon18-rgb/Election-Command-Center/pull/466
- Pages40410619987 SUCCESS; ALL151 expected published files match at22:14:42Z.
  Initial pre-completion read saw5new-file404s; after completed deployment all
  match. No source/model/runtime activation was part of this audit-only release.
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40410619987
- Used waiting time for bounded original2024countyarchive discovery: normal
  browser GET200/yearselector2024exists, but no election-file rows rendered even
  after explicit wait. Saved actual page/network state, not an archive baseline.
  Do not guess asset IDs, substitute district totals for210precincts, or claim
  missing files globally from this selector failure. Source-clock semantics and
  an independent matching historical precinct export remain exact AZ01blockers.
- Next: inspect archive's declared file-list source/selector implementation once,
  or independently published official2024precinct export. National9route system
  remains experimental; zero accepted actual returns/calibration limits unchanged.
  Deployment465 already notified; this source-audit completion needs no repeat.


## October26 21:56Z — exact official AZ01 text obtained and audited

- Normal public Edge page GET200 exposes literal county results link. Normal
  browser request GET200 obtains31,328,879bytes, SHAe19723f24e1f7818853a7d13200c751727d9d6dd0a18c377e17c631393c0d7ce,
  LastModifiedOct24. Python ordinary requests403 remains; no security bypass.
  Earlier24MBinspection cap rejected the first body; reviewed128MBcap completed
  normal-browser observation. This is not proof of a headless production collector.
- Actual county file exactUSRepDistCD-1 has1477rows:7candidate identities times
 210precincts PLUS7blank-precinct summary rows. All counts ZERO. Never count
  blank summary as a211thprecinct or sum it twice. Votes reconcile across four
  stated methods. New offline inspector rejects duplicates, identity drift,
  missing matrix/summary, invalid counts and mode/summary disagreement; tests and
  full actual-file inspection PASS. Inspector never admits live evidence.
- Statewide enhanced app normal browser/API confirms its sole item is GOVERNOR,
  notAZ01; no guessed contest IDs or governor-to-House wiring. County candidate
  names includeShahDEM/FeelyREP/AlponteLBT pluswriteins; independent ballot and
  precinct/baseline contracts still required, not approved fromzero template alone.
- Source assessment updated; actual file/browserAPI saved locally. Next meaningful
  step: county2024same-district precinct export plus exact210precinct geography
  reconciliation and source-clock/live semantics. No new national input or live
  calibration claim. No repeated403/source probe necessary.


## October26 21:41Z — bounded pivotal AZ01 source discovery

- No existing NC2026district reaggregation implementation found; preserve NC01
  changed-boundary blocker and move to uploaded rank7AZ01, whose current Census
  bridge says unchanged. Do not use whole-Maricopa totals for this district.
- Actual official county page links2026general results text (filenameZero forweb).
  Ordinary download and old statewide landing return403; no bypass attempted.
  Search discovers enhancedvoting Arizona2026general app, ordinary GET200.
- Read actual app base/main scripts: declared /results/public/api and getElection
  route. Exact public2026general metadata API GET200,CORS*,max-age60, production
  true/nonprimary/dateNov3, staleOct16 and ballotItemCount1. These are metadata,
  not proof that the sole ballot item is AZ01 or that results are live.
- Pinned data/arizona_house_01_source_assessment.json; JSON/election/no-enable
  assertions pass. Actual source HTML/API/bundles saved locally under
  artifacts/readiness/arizona-source-research. Official sponsorship link chain,
  exactAZ01contest/candidates, precinct/district-part baseline and reporting/
  remaining-ballot semantics still required. No additional national input enabled.
- Next: inspect ordinary app network/declared ballot API once and verify official
  linkage; ifAZ01notpublished record exact blocker, do not guess contest IDs or
  repeatedly retry403. Main deployed checks remain successful; no active newPR.


## October26 21:26Z — pivotal NC01 official archive inspected; geography blocker isolated

- Reused existing official catalog/download discovery, inspected queued211 before
  acting. Real official catalog lists11/03/2026, download flag1. Actual HTTPS
  official S3 ZIP is accessible, SHA a0a046b2878157904343e9053f747094c7230a8d5c0e2e80359e264071ac73fe;
  Last-ModifiedOct5. Full141466rows share2026election date, CRC checked.
- Exact US HOUSE OF REPRESENTATIVES DISTRICT01: DonDavisDEM, LaurieBuckhoutREP,
  TomBaileyLIB; each350precinct rows across25county/district parts, ALL ZERO.
  No embedded reporting clock; not live approval, test/live semantics unverified.
  data/north_carolina_house_01_source_assessment.json records actual source and
  exact blockers, no activation. Local metadata assertions passed.
- Current geography bridge NC01 explicitly changed_requires_reaggregation and
  historical_comparison_available=false. Existing statewide NC Senate/presidential
  baselines cannot substitute for2026district-part history. This makes matched
  new-line historical precinct aggregation the decisive NC01 forecasting blocker,
  rather than continuing to claim the ZIP is missing. Need independent ballot/
  precinct/FIPS contract, reporting semantics and remaining-vote evidence as well.
- No source panel/model promotion, no repeated blanket probe. ZIP and full audit
  saved locally under artifacts/readiness/nc*. Next bounded work: assess existing
  new-line historical aggregation resources; if unavailable move to uploaded
  priority AZ01 with unchanged-boundary check. Keep source claims distinct from
  usable predictive inputs. No change to national9route live acceptance status.


## October26 21:11Z — bounded predictive acceptance assessment completed

- NATIONAL_NEEDLE_ACCEPTANCE.md reviews implementation, independent transport,
  actual-input availability, historical skill/chronology, uncertainty calibration,
  comparative lag and national coverage against actual saved evidence.
- Decision: deployed experimental implementation passes; calibrated national
  predictive acceptance does not. Iowa6.63point assumed-order MAE is not a held-out
  chronological calibration result; Thurston1of7parts does not supply that gap.
- No new claim of data availability, approved model promotion or owner-approved
  fallback. Next bounded source work: pivotal missing NC01/AZ01 or independent
  PA10/NY17 fallback, and chronological remaining-vote evidence; inspect queued
  NC PRs before duplicating. No repeated unchanged vote probes or new race panels.
- Inspected current open PRs: no new active source PR;465merged,426paused,59
  superseded. Current final Pages and official collector remain successful;
  routine source preflight in progress is non-actionable. Last daily report
  remains2026-10-26; no repeat milestone notification.


## October26 usage/readiness decision checkpoint

- Owner asks whether completion is achievable with85%usage remaining and whether
  to narrow scope. No estimate of available task-hours follows from that percentage;
  missing data cannot be resolved by promising more compute. No new scope change
  was approved. Preserve ONE national results-informed needle as the authorized
  primary deliverable; the assistant's proposed fallback is a recommendation,
  not owner acceptance of replacing it with a descriptive results dashboard.
- Keep the already-authorized October27 source/calibration decision bounded:
  review existing chronological evidence and estimator evaluation once, identify
  exact missing inputs, and separate implementation readiness from validation.
  Do not repeatedly run unchanged probes, broaden safe-seat coverage, add panels,
  or use test/commit counts as evidence of predictive readiness.
- Evidence inventory: national bridge and independent official transport deployed;
  synthetic national movement/retraction tests pass. All9actual routes have no
  accepted positive returns. Iowa historical evaluation uses ASSUMED release order
  and neutral prior; it is not chronological or probability calibration. Thurston
  chronology covers only1of7county parts; it cannot validate a statewide/national
  forecast. A validated national predictive acceptance criterion remains unmet.
- Next useful work is that evidence-based go/no-go assessment and an exact list
  of pivotal-race missing data, using existing artifacts first. Optional feature
  expansion stays paused. No further unchanged live-source polling in this run.


## October26 20:54Z — independent official WA03-to-NATIONAL path verified deployed

- PR465 tested head a4485e09ca77e234b3c80f8182afd892d08e85b1: ALL35 workflows
  success;46 latest checks42success/4nonapplicable skips; no external statuses;
  exact head/mergeable clean verified before authorized merge.
  https://github.com/jmon18-rgb/Election-Command-Center/pull/465
- Merge e9d3e81a4b2d20b7368ced994f3cb1e73e0f5529; final briefing-bot main
  1061a2602ba0837e9369750f816f1c35a0887329. Pages40399515539 SUCCESS;
  original merge build canceled/superseded. At20:53:53Z ALL146 expected published
  files match final main; actual remote dashboard coherence smoke passes.
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40399515539
- REAL backend bootstrap40399466905 SUCCESS, original official GET200 at20:52:33Z,
 640ms request-to-body, unchanged original source hash/staleOct22zero. Publishes
  HEALTH ONLY payload=null. Owned data branch a1eed28b5384ca994a29aaffef1181ba9ed08be3;
  public raw GET200/CORS*/byte-for-byte equality verified20:53:11Z; max-age300.
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40399466905
  https://raw.githubusercontent.com/jmon18-rgb/Election-Command-Center/official-results-cache/data/washington_house_03_official_latest.json
- Official WA03 is now the ninth implemented NATIONAL input, independent of civicAPI.
  No separate race panel added. Its original seven district/county parts feed the
  existing remaining-vote estimator and bounded correlated national likelihood.
  Published1366/390 SYNTHETIC tests pass automatic before-call national movement,
  correction/retraction/zero-old-reply replay exclusion, outage/integrity withdrawal,
  minute request floor, hidden-tab pause, archive isolation and missing-helper safety.
  Synthetic screenshots/tests are NOT genuine election delivery or calibration.
- Separate ACTUAL published nine-route real-clock/fixture-free probe20:54:04Z:
  eight civic routes200/non-test/stale zero; official owned route200/health-only;
  ZERO admitted inputs, projections, raw archives or page errors. Status remains
  LIVE_DELIVERY_UNPROVEN. Local probe revision a4485e09/dirty reports the local
  runner checkout, not deployed revision; separate146-file comparison pins live1061a260.
  Evidence: artifacts/readiness/competitive-live/report.json,
  published-main-integrity.json, washington-owned-publication-verification.json.
- Post-close official collector scheduling is deployed, NOT yet exercised in a real
  election. Collection/Actions scheduling/raw cache/client may add MINUTES; no
  independently matched publication batches, speed parity, interval calibration or
  national coverage claim. Up to6House districts/5states remains limited evidence.
  Pre-election health receipt will expire safely; normal vote collection starts
  Nov4 04:00Z, bounded schedule throughNov25; code-stopNov4 noon is unchanged.
- NEXT: prioritize actual uploaded pivotal-race gaps and independent real-batch
  chronology/remaining-vote evaluation. Four genuine Thurston2024 partial reports
  cover only1of7WA03parts and59%-97%of final two-party votes; ZERO approved
  calibration inputs. Do not expand panels, celebration polish or generic refactors.
  Last daily report remains2026-10-26; this is a completed deployment milestone.



## October26 after19:58Z — official WA03 collection-to-NATIONAL path implemented, review pending

- readiness/washington-official-transport now implements the bounded collector,
  fixed owned data-only branch publisher, official cache integrity/reparse,
  independent headless controller and SAME national likelihood/model path.
  Source URL remains the original official API; owned cache is transport only,
  never another independent observation. Duplicate race evidence is rejected.
  Ninth input means at most6House districts across5states, not nationwide coverage.
- Collector: one fixed anonymous official GET,20s timeout/2MiB bound. Publisher
  can write only data/washington_house_03_official_latest.json on fixed
  official-results-cache branch, refuses default-branch publication, preserves
  latest source/zero revision watermark across failures, rejects late receipts/
  older source publications, and refreshes unchanged health at most every5min.
  No rule/protection bypass. Current public repository rulesets list is empty;
  code/main writes still require this PR's exact-head checks and normal merge.
- After tested merge, a main-push bootstrap publishes a REAL pre-election health
  record with payload=null, never votes. Actual2026post-close collection starts
  Nov4 04:00Z, max4requests/job >=60s apart on5min workflow schedule during first
  night; one request/job thereafter through Nov25 08:00Z. Data collection can
  continue after the owner's Nov4 noon CODE-change stop. Exact-year guards hold.
- Client adds at mostONE cache request/minute, separate from existing32/minute
  civic county starts, all sharing existing4active/64queue/8priority-reserve pool.
  It pauses hidden/inactive tabs, has bounded error backoff and independent mode
  generation (civicAPI outage cannot suppress/reset this source). Receipt expiry
  15min first night/30min thereafter; original official snapshot180min guard stays.
  Cache max-age60 at source and300 at owned transport plus workflow scheduling
  may add MINUTES; never promise AP/NYT parity or treat quick HTTP as latency proof.
  UI gives official attribution, source and collection clocks, explicit delay risk.
- Local tests pass collector/body bounds, hash/clock/status/source reparse,
  fixed branch/default-branch denial, zero/retraction watermark across outage,
  all9-source coexistence, unchanged baseline draws, bounded state influence,
  duplicate exclusion and single-county national rejection.36core checks pass.
  Actual Edge1366/390 SYNTHETIC WA-only tests prove automatic NATIONAL movement
  before calls despite civic routes unavailable, correction/zero/old-reply/outage/
  integrity exclusion, minute budget, hidden-tab pause, archive isolation, missing
  optional-helper fallback. Existing8-source national browser regression passes.
  Local full DOM passed; latest exact-head CI/merge/deploy still required.
- Visual QA caught/fixed an attribution/count bug: WA driver was initially
  mislabeledcivicAPI/noHouse; now explicitlyWashington official/collected copy,
  seven district/county PARTS and oneHouse source inWashington. Screenshots are
  synthetic fixtures, not actual election returns. No new race panel was added.
- Actual local-candidate fixture-free probe: all8 civic routes200/stale zero;
  new owned WA cache404 (not bootstrapped yet), no accepted input/page errors.
  This is NOT deployed or actual positive live forecasting. After all current-head
  checks pass: merge, verify Pages/52loaded scripts+new files, verify automated
  REAL health bootstrap and owned-channel CORS/readback, published laptop/mobile
  synthetic9-source behavior, then separate actual9-route real-clock canary.



## October26 19:55Z — official Washington source preparation verified deployed

- PR464 final a42c6b9cc7b10097b4761d1e90a94893467b2c5a passes ALL5 workflows;
  all8 latest checks inspected:7success/1nonapplicable deployment skip,
  no external statuses; exact head/mergeable clean before merge.
  https://github.com/jmon18-rgb/Election-Command-Center/pull/464
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40388645861
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40388645845
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40388645859
- Merge/final main a28b460efa3958bc5f5217558813ecb6fa388039; final Pages40390656671
  succeeds (earlier briefing-bot5e40f725 build canceled/superseded). Actual
  19:54:42Z ALL137 expected files match; remote dashboard coherence smoke passes.
  Nine new published Washington preparation files independently verified.
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40390656671
- This is source/baseline/adapter PREPARATION, NOT a ninth national input.
  Existing national runtime remains8sources. Last actual fixture-free eight-source
  observation19:28:57Z remains stale zero/non-test with no admitted evidence.
  Source404/zero/stale cases must never be reported as verified live delivery.
- NEXT ACTIVE BRANCH: readiness/washington-official-transport, based on the
  verified merged main. Bounded collector and tests promoted to
  scripts/collect_washington_official_results.cjs and
  scripts/test_collect_washington_official_results.cjs; local tests pass:
  one fixed official GET,20s timeout,2MiB body cap, zero/stale rejection,
  original-object-only selection/reparse,503 and oversize rejection. Actual
  prototype observation19:43:54Z HTTP200, same pinned original source SHA,
  stale snapshot rejected, payload=null. No publisher/schedule/controller yet.
  Finish a coherent reviewed collector/publication + national wiring change;
  don't just add another race panel or claim this local collector is deployed.
- Own repository raw transport feasibility GET returns Access-Control-Allow-Origin
  *, but max-age300. This is a possible owned cache channel, NOT freshness or
  publication-speed proof. Main protections must remain intact; do not use an
  arbitrary proxy, bypass browser security, or hide collection/cache/schedule lag.
- Useful historical-source lead VERIFIED locally while CI ran: four actual
  original Thurston2024 dated partial reports (Nov5,6,7,15) downloaded HTTP200,
  hashes recorded, page4 counts/report-generation footers visually checked via
  the PDF skill; Nov5 statistics page1 also visually checked. Research saved:
  artifacts/readiness/washington-source-research/verified-thurston-partial-sequence-research.json
  Original count progression is real, not scaled final totals; earliest contains
  59.09% and last97.08% of eventual CD3-part two-party votes. Still only ONE of
  SEVEN parts, no under25% sequence, inferred Pacific report-generation clocks
  rather than independent capture/publication clocks, and zero approved model
  calibration inputs. Do not relabel2024 Perez/Kent as2026 Perez/Braun.
  The old historical landing alias redirects to2026; original linked PDFs remain
  accessible and are saved locally, so don't repeatedly probe that redirected page.
  Existing one-county/early-coverage and national calibration limits remain real.



## October26 19:29Z — historical vote correction deployed; independent WA03 path prepared

- PR463 final cc8b60fac5146b43b95e545aad7b6946f87e5661 passes all34 applicable
  workflows. Latest43 check jobs:40success/3nonapplicable deployment skips;
  no external statuses; exact head/mergeable clean verified before merge.
  Canceled browser installs and a validation source-probe timeout/HTTP503
  were retried on the SAME head, with no checks waived. Full DOM and all
  current-head validation/browser jobs finish successfully.
  https://github.com/jmon18-rgb/Election-Command-Center/pull/463
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40383902731
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40383902367
- Merge6bf06b26445c3a811dfb39344345ae900ebe1d79; final briefing-bot main
  e8f290ff0747b391a8aa821767296bee266b9b29 Pages40386829421 succeeds.
  Actual19:28:30Z comparison matches ALL128 published expected files.
  Separate actual-site smoke passes forecast lineage and coherent four endings.
  Actual published1366/390 synthetic national tests pass eight-source movement,
  correction/withdrawal/outage/test/stale exclusion and missing-helper fallback.
  https://github.com/jmon18-rgb/Election-Command-Center/actions/runs/40386829421
- Historical party/fusion repair and BOTH years' independent agreement flags
  are now deployed.2022 agreement399->427;2024 agreement403->433. Existing
  exploratory persistence diagnostics now153prior winners/35states,149later
  wins/4losses, coefficient .343, still UNPROMOTED. Do not merge old PR59 again.
- Separate actual published fixture-free19:28:57Z probe: all8 civicAPI routes
  HTTP200/non-test, stale zero counts, NO admitted evidence/projections/raw
  accepted archives/page errors. Live delivery, calibration and comparative
  publication latency remain UNPROVEN. No source-driven needle movement claimed.
- Useful next-source work: owner's uploaded tipping priority audit identifies
  WA03 rank13; current polling remains genuinely competitive. Official Washington
  SOS results link now redirects to results.votewa.gov/results/public/washington.
  Its PUBLIC election list actually lists20261103 (not a guessed future ID).
  Public app-linked API returns the exact WA03 general-election contest, verified
  John Braun/Marie Gluesenkamp Perez identities and ALL7county district parts.
  Actual200/isProduction=true, asOfOctober22, ZERO counts. Cache max-age60.
  Pinned original2024 official county CSV reproduces215177D/199054R/1673write-ins,
  matching independent historical staging and unchanged2026 Census boundaries.
- Isolated readiness/washington-official-source now contains a strict tested
  official adapter, pinned pre-close sample, original-source baseline importer,
  independent Census crosswalk and verification workflow. No new national input
  or browser controller enabled. Exact transport blocker: ordinary GET with the
  dashboard Origin receives NO Access-Control-Allow-Origin. Need permitted
  server-side collection/publication, with its additional delay disclosed;
  do not use an arbitrary CORS proxy or promise a direct fast browser feed.
  Next: review/merge this source preparation with checks, then implement the
  actual collection-to-national path with correction/retraction and single-race
  deduplication. Do not equate this prepared source with live delivery.



October26 continuation: PR463 exact head eae422d4ae28c8474d424c1eb0019bc70aac9838
remains unmerged pending complete current-head CI. Previous44e84375 validation
caught a dependent historical persistence study still using the old191-district
universe. Corrected and deterministically rebuilt BOTH historical persistence
and modern-cohort diagnostics:153 previous winners/35states,149 subsequent
wins/4losses; exploratory fitted coefficient .345->.343. This is a source-driven
reproduction of an existing research study, NOT promotion of a new production
coefficient or evidence of calibrated2026 odds. Added both studies to default
read-only atomic bundle verification and workflow path triggers. Leakage,
reproducibility, modern-cohort and all33 core checks pass locally; full local
DOM and desktop/mobile eight-source synthetic browser tests previously passed.
Follow-up also refreshes2022 independent agreement flags (399->427 matches),
without changing candidate names/votes. Both years now have exact per-record
agreement checks. A new current-head CI cycle is required for this correction. Do not infer deployment or merge from local test success.
https://github.com/jmon18-rgb/Election-Command-Center/pull/463

Next: finish exact-head CI, merge only all-green, verify Pages and actual
published files/runtime (integrity helper extended from109 to128 files).
Do not reapply PR59 afterward. Independent Iowa source reconnaissance: official
SOS results archive's2026General result entries are not yet linked; its linked
electionresults.iowa.gov root returns a JavaScript robot-verification page to
ordinary web retrieval. No feed or access bypass invented; this is not a usable
independent live fallback. Existing8-source actual post-close delivery and
comparative publication latency remain unproven.

Owner-authorized October 25, 2026. Target: dependable November 3 laptop operation.
Feature freeze: October 31, America/New_York. November 1 onward: defects,
acceptance testing and recovery only. Stop unattended changes November 4 at noon Eastern.

## Work order

HOUSE HISTORICAL SOURCE MIGRATION IN PROGRESS (October26 after17:56Z): branch
readiness/house-history-atomic ports the factual repair from queued PR59 into
the current data/model chain, preserving that branch. Pinned original mirror
CSV SHA25676eec42483ee9f0fc5cf6e377442c783d1ae6eefa929729fd6561a69bab47f2a;
official Minnesota3 page and existing official NY17 export corroborate the
DFL/fusion fixes. Exactly matching names AND publisher-marked fusion tickets
are required for endorsed minor lines; separate candidates/write-ins never
transfer. No probabilities or partisan coefficients fitted. All870 district
source totals are conserved, and the same raw CSV reproduces old published
classification before applying the repair.2024 independent candidate agreement
improves403->433, with AK01/AZ02 still blocked; historical matched House
incumbents149->169, comparable2024 districts238->245, paired2022/24 districts
191->197. Senate/governor assumptions and same-seed Senate control stay unchanged.
The controlled public-baseline diagnostic uses the SAME17:49 polling snapshot:
House control91.57->90.87%, Blue Tsunami48.47->47.83%; not calibration/live results.
The staging-only publishing bot is replaced by read-only coherent-bundle checks;
do not promote incomplete descendants. Original-source, provenance, geography,
candidate-history,32 existing core plus one new safety check pass locally;
desktop/mobile eight-source national fixtures pass. Full DOM/CI/deploy pending.

NY17 NATIONAL INTEGRATION DEPLOYED (October26 17:51Z): PR462 extends the existing headless shared House source,
revision/cadence/correlated-draw likelihood/rehearsal/canary path to NY17. No
separate needle panel. Use the full official Lawler fusion baseline197845,
not the180924 Republican line alone. Eight inputs now imply5 House districts
across4 states, still limited/experimental; client budget32 regular automatic
starts/minute,8 reserved queue positions/56 bulk, existing4active/64total cap.
Published desktop/mobile synthetic tests prove NY-only and combined8 national
movement before calls, corrections, retractions, test/outage/stale exclusion,
fixed Wisconsin budget and baseline isolation. Actual PUBLISHED real-clock17:50:15Z
probe sees all8 HTTP200/non-test but stale zero counts; no admitted evidence,
projection, page errors or raw archives. This is NOT live delivery/calibration.
Parent PR461 merged6738f597 after all6 workflows pass. PR462 final0128d437
passes all34 applicable PR workflows plus one same-head push workflow; all44
check jobs inspected:41success,3 nonapplicable deployment skips, no external
statuses. Mergeae89ab29; final briefing-bot main7ad3d4d4 Pages40372214783 succeeds.
Actual109-file comparison includes all49 loaded scripts and refreshed model/
poll inputs; remote forecast-bundle coherence and published synthetic runtime
pass. Independent official NY source access remains403, not a usable fallback.

NEXT PRIORITY: finish source/model correctness before further source expansion.
The NY17 official fusion audit confirms the broader queued PR59 historical
party/fusion importer repair needs atomic integration. Read the existing patch
and verify facts against original sources; do not merge the old branch wholesale
or publish only changed staging files. Current default House preparation uses
recorded D/R history for district/state/national baselines. Rebuild2022/2024
staging, geography, paired House context, candidate history/fundamentals and
derived model snapshots together, updating NY17's explicit staging reconciliation.
Fix the staging-only publication workflow in the same tested migration so it
cannot leave downstream snapshots stale. Preserve Senate behavior where a
House-only correction should be invariant, all owner thresholds, existing
national likelihood/source gates, paused work and required checks. Explain
source-driven probability changes; never fit a desired partisan outcome.
The ignored artifacts/readiness/house-fusion-migration-review.json records
read-only code/dependency findings, not applied changes. Keep independent
source/timing acceptance separate: actual post-close delivery and held-out
chronological calibration remain UNPROVEN; do not circle blocked archives.

NY17 source preparation (October26 after17:01Z): uploaded tipping rank4,
unchanged district boundaries, four county parts. New official historical
contest CSV is accessible through the state-linked Civera download. Preserve
candidate-specific fusion: Lawler Republican180924+Conservative16921=197845;
Jones Democratic173899; Frascone Working Families7530 is a DIFFERENT candidate.
Keep generic write-ins234/blank13917/void535 separate. Existing global staging
records Republican line only and includes the other line/blank/void in other;
do not silently claim it is candidate-total reconciliation or overwrite PR59.
The NY17 importer/reference are historical inputs for the now-deployed shared
national controller. Documented civicAPI87319 route has correct four identities
and Conley/Lawler roster, but actual reply is stale October22 with zero counts.
Independent nyenr.elections.ny.gov ordinary client AND normal Edge get403/
Just a moment; no bypass, no usable fallback or comparative speed claim.
Source preparation and national integration are complete within their declared
scope; real live delivery is not proven. NC01 needs new-boundary historical
reaggregation; AZ01 needs a defensible subcounty geography rather than relaxing
the national minimum3 reporting-unit coverage merely to fit one county.

Independent PA10 timing implementation (October26 16:43Z):
scripts/pa10_results_timeliness.py now contains published-link discovery and a
bounded post-close server-side paired recorder; pa10_timing_provider.cjs reuses
the production PA10 source validator. Seven synthetic tests pass locally.
The real county menu still has no2026 general link (HTTP200, Age1951), so the
watch must remain gated; never guess a future election key. PR460 final f09db811
passes all4 applicable workflows/6 check jobs (one additional nonapplicable
deployment skip), merged a940cea9. Pages40364154987 succeeds; actual80 existing
files plus3 recorder files match published bytes. Workflow397307200 is active.
Initial/recurrent/unmatched D/R vectors cannot prove freshness. Receipt windows
include caching/sampling/transport; never present as publisher-origin latency or
AP/NYT parity. This capture-only path must not duplicate national likelihoods.

PR459 DEPLOYED (October26 16:29Z): PA-10 uploaded tipping rank1, current polled linked D60.27%, original
state2024 precinct extract now reproducible (340 precincts/three district parts;
Census67, unchanged map and exact MIT reconciliation). Extend the same national
counts path, not a new race panel. This yields four House districts across THREE
states plus three Senate pilots, still limited/experimental national evidence.
Keep the existing minimum3 reporting counties: PA10 needs all3 county parts with
qualifying counts; a single appealing county batch cannot move the national odds.
Seven-source post-close target budget28 regular automatic requests/min, with
shared4active/64queued unchanged and7 reserved priority positions/57 bulk.
PR459 tested head3bd56234 passes all33 applicable PR workflows/39 check jobs
(three other check jobs are nonapplicable deployment skips). Mergeafe0470c;
published briefing-bot maina5acae18. Actual80-file integrity, published synthetic
Edge1366/390 national path and real-clock seven-source rejection checks pass.
Independent timing/fallback is NOT solved by this additional civicAPI route.
Completed by PR460: independent PA10/Dauphin matched D/R-snapshot recorder.
Activate real2026 collection ONLY after a verified published general link exists.
Do not guess future keys or weaken eligibility. The implementation contract
artifacts/readiness/next-dauphin-independent-timing-contract.json and
readiness-progress.md contain concrete scope/data/receipt-clock requirements.
Cumberland currently links only May2026 primary results; Dauphin's accessible
public application currently lists2026 primary plus its2024 archive, not a
verified November2026 feed. Investigate that distinct official county format
rather than revisiting the blocked state Incapsula page. Preserve actual-source
cache/freshness gates and do not invent future election IDs or publication lag.


PR458 DEPLOYED (October26 15:39Z): MI-04 (uploaded tipping rank19, default linked D57.37%, polled)
adds one House STATE to the national counts path, with processed OpenElections
2024 county PARTS, complete Census/map/MIT reconciliation and independent original
Kalamazoo sample. Three House districts across TWO states remain limited coverage.
This addition is national evidence, not a new race panel or a timeliness solution.
PR458 exact tested head617fbce6 passed all33 PR workflows and40 applicable check
jobs (3 additional deployment skips); merge23222679, published bot949a8184. Actual
published synthetic-browser national tests and73-file integrity verification
pass. Real-clock15:39Z six-source probe still rejects all stale zero-count inputs.
Next source candidate is PA-10: uploaded rank1, current polled linked D60.27%;
original official2024 precinct file and exact87385 source geography reconcile.
See readiness-progress.md for full evidence, independent live-access gap and
remaining checks; adding another civicAPI route alone never settles latency.
The six-input cadence budget is24 regular automatic requests/minute after close;
shared concurrency4/queue64 stay fixed, with6 priority positions/58 bulk positions.
At15:14Z actual candidate responses have test_data=false but old October16-23
publication timestamps; strict freshness rejects them. This supersedes the old
all-five-TEST observation, not the requirement to prove real post-close delivery.
Actual Cache-Control advertises max-age15/stale-while-revalidate30, with no Age
header in that observation. Do not turn that policy into measured stale delivery
or a guaranteed bound, or bypass verified URLs to claim cache busting. Request
and cache metadata are not independently matched real vote batch comparisons.


LATEST HUMAN CONCERN (October 26): competitive source selection must be checked
against the uploaded Silver material, and source speed must be demonstrated.
The uploaded House tipping-point order places WI-03 ninth, MI-04 nineteenth and
WI-01 forty-second; pilot feasibility is not equivalent to top-ranked importance.
The civicAPI FAQ's 5-10 second active-election claim is a provider statement, not
an independently measured advantage over publications or a verified SLA. At that initial morning review, all five
connected full feeds returned TEST DATA; later observations below supersede that
state. Always inspect the current actual probe rather than pinning a test flag. Prioritize reducing our own
polling delay, measuring actual request timing, independently matched real batch
comparisons and usable independent fallbacks alongside national breadth. More
races on the same provider alone do not establish timely delivery. Preserve
source admission, shared concurrency/backoff and experimental model safeguards.

PR457 now deploys the scoped deadline scheduler (15s active post-close target,
10min pre-close, existing minute fallback) and records HTTP request/body timing.
Actual published synthetic-browser tests exercise automatic national updating;
actual five-source TEST responses remain excluded. This does not settle provider
freshness or comparative publication lag. See the latest readiness-progress.md
for current revision, independent fallback limits and the new original Kalamazoo
2024 county sample corroborating the processed MI-04 historical candidate.


LATEST HUMAN CLARIFICATION (October 26): the primary deliverable is the
NATIONAL NYT-style results-informed Blue Wave / Blue Tsunami outlook. Individual
Iowa/Kansas/Texas race needles are supporting inputs and diagnostics. Their
completion does not complete the requested national needle. Reuse them; do not
expand race-panel production or generic hardening ahead of the missing bridge.

At the October 26 clarification, the correlated House/Senate Four Endings model
accepted verified calls but lacked the county-return connection. PR454 now
implements and deploys the scoped experimental connection; see
NATIONAL_RESULTS_NEEDLE_CONTRACT.md and readiness-progress.md for tested evidence
and remaining limits. PR455 deploys WI-01 district-part county counts; PR456
adds WI-03 within a fixed shared Wisconsin evidence budget and extends the
isolated national rehearsal. Two House districts in ONE state plus three Senate
states remain limited coverage, not national House assurance or calibration. Continue testing that explicit partial-return contract
within the same national model. Do not average race probabilities or count a
poll-informed race posterior as independent evidence against the same poll prior.
Distinguish local/candidate effects from shared national effects; three Senate
states provide limited national evidence and especially limited House evidence.
Preserve source/remaining-vote uncertainty, bounded influence, correction and
retraction behavior, and baseline-versus-results attribution. Keep the owner's
existing four outcome thresholds and coherent joint probabilities.

Build a scoped experimental national updating path for review and evaluation;
NYT-grade calibration is not a prerequisite for implementing it and must not be
claimed without evidence. Do not silently promote raw precinct percentages,
statewide margins or unsupported cross-race extrapolation. Provide an isolated,
clearly labeled national rehearsal so the owner can inspect results-driven
movement while real providers remain in test mode; fixtures never enter live
counts. Tests must demonstrate the NATIONAL outlook moving before race calls,
not merely individual race panels changing. Finish already queued critical
fixes with required checks, then concentrate subsequent work on this bridge.
This clarification supersedes older race-first task ordering below.

LATEST OWNER PRIORITY (October 25, after the source-progress review): deliver
LIVE RETURNS THAT INFORM A PROGRAMMED PREDICTIVE NEEDLE, primarily CLOSE RACES.
This supersedes the older task ordering below. Do not use source-gap counts,
manual links, maps, passing regression totals or provider winner flags as proxies
for this deliverable. Pause further UI, alert, celebration and generic reliability
expansion unless it directly unblocks the source-to-needle path or fixes a critical
production defect. Preserve queued work and required checks.

Start with Iowa Senate: the current linked model is approximately even and its
polling input has 14 contributing firms / 8 independent firms as of October 22.
Kansas Senate is the next Senate target. FL-09, CO-05 and TX-23 are close House
targets, with thinner polling. Re-rank using current linked odds AND actual
polling evidence; a missing-data/uncertain safe seat is not automatically a tossup.
Do not spend custom source-integration time on overwhelming favorites or races
expected to be called immediately after polls close; reuse existing broad feeds.

The next implementation milestone is one competitive race end to end: permitted
real source -> exact race/geography/method counts -> modeled remaining ballots
with uncertainty -> partial-return forecast -> visible updating race needle.
Program and evaluate the estimator; descriptive comparisons do not fulfill it.
Keep modeled outstanding votes distinct from counted votes and historical replay
distinct from live delivery. Use historical evaluation to assess uncertainty,
and label an unevaluated prototype honestly. Do not falsely claim calibration.
Keep any national correlated update disabled until its transfer is justified.
Report exact source/data/access blockers promptly and continue independent
estimator work; do not repeatedly monitor a blocked archive or build more polish.

Latest owner steering (October 25 evening): pause further celebration artwork,
music and expansion. Preserve deployed work and open reviews. Prioritize
competitive-race source gaps/fallbacks, verified calls/control accounting,
outage/correction recovery and the dependable single-screen laptop experience.
Continue scoped needle evidence work where it resolves a real data gap. This
overrides the celebration production targets below until the owner changes it.

1. Run the consolidated readiness checks immediately; fix failures before features.
2. Verify a single-screen laptop experience: model, observed results, decisive races,
   attributed calls, source health and supported geographic comparisons.
3. Exercise existing integrations under outages, delayed updates, corrections,
   withdrawn calls, background tabs and recovery. Reuse adapters and tests.
4. Check deployed bytes and real desktop/mobile behavior. Keep real-provider soak
   evidence separate from simulated elapsed time and synthetic fixtures.
5. Pursue chronological historical replay only where timestamped, usable archives
   exist. Preserve explicit gaps; final totals are not a reporting-order archive.

Use ELECTION_NIGHT_ACCEPTANCE.md as the acceptance authority and the current
competitive-race-first priorities in ROADMAP.md. Owner clarification: the needle
and celebrations are high-priority deliverables alongside core reliability.
Do not defer them behind unrelated roadmap research or optional polishing.

## Needle and celebration delivery targets

- Needle: start with one supported race/state and an end-to-end source-to-display
  update, including freshness, comparison baseline and an uncertainty explanation.
  Keep the existing national joint model separate unless geographic updates have
  validated calibration. A descriptive comparison does not satisfy the predictive
  needle request; record the distinction and any remaining data blocker plainly.
- By October 27, target an evidence-based decision on a scoped predictive version:
  identify usable chronological historical returns, comparable live source data
  and held-out evaluation. If missing, report the exact gap and supported fallback;
  do not spend every subsequent run rediscovering the same blocked archive.
- Celebrations: reuse the existing event roster, posters and validated call gates.
  Follow CELEBRATION_CREATIVE_BRIEF.md for the owner's specific scenes, Fish Head
  announcement-before-music sequence, candidate distinctions and audio direction.
  Build a shared timed animation player with distinct event storyboards, local
  assets, skip/replay, sound controls and reduced-motion behavior. Preview mode
  must exercise the same player while staying isolated from earned live events.
- Target a complete celebration preview roster by October 29; use October 30–31
  for desktop/mobile, duplicate-event, queue and call-retraction verification.
  Begin with local SVG/CSS animation and existing audio; optional art/audio upgrades
  must not block working sequences. These dates are targets, not proven delivery.

## Execution and evidence

Inspect working changes and open PRs before starting; never overwrite another run.
Choose a bounded task, implement it, run relevant checks, repair failures, and make
small coherent commits on a development branch. Open/update a reviewable PR.
Routine engineering decisions do not require approval. Preserve branch protections;
The owner authorized merging and deploying routine tested readiness improvements
after applicable checks pass. Verify the deployed result and preserve required
protections. Never publish private source material.

Run `node scripts/run_election_readiness.cjs` for the dependency-free core suite.
Add `--remote` to include the existing deployed-site smoke. Reports go to
`artifacts/readiness/`; JSON includes each command's status, elapsed time and log.
The scheduled Election readiness report workflow also runs actual Chromium drills.
Its artifacts and job summary are evidence for the tested commit, not blanket
proof of live coverage or calibrated forecasts.

Update readiness-progress.md after substantive work: tested revision, commands,
pass/fail, evidence URLs, unresolved acceptance gates and the next concrete task.
Do not call a skipped, stale, failed or unrun check a pass. Mock tests never prove
actual November 3 vote delivery, source rights, or forecast calibration.

Scheduled continuation is every 15 minutes in this chat, subject to local app and
computer availability. One daily report on the first run after 9 a.m. Eastern:
completed changes, test evidence, open risks and next priority. Record the last
daily report date. Notify sooner for failures needing human action or a material
readiness milestone; keep unchanged monitoring quiet.

The interval is a continuation opportunity, not a time limit on active work.
Continue implementing, testing and repairing the next useful readiness task
within each run. Avoid overlapping edits. Triage the remaining roadmap by
November 3 operational acceptance and explicitly defer optional features.
