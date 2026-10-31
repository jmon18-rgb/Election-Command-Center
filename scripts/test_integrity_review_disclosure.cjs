'use strict';
// Actual page renderer in an isolated DOM. No application bootstrap, source GET or model.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),ROOT=path.resolve(__dirname,'..');
const candidate=fs.existsSync(path.join(ROOT,'index.integrity-candidate.html'));
const html=fs.readFileSync(path.join(ROOT,candidate?'index.integrity-candidate.html':'index.html'),'utf8');
const start=html.indexOf('function renderIntegrityQueue(d){'),end=html.indexOf('// The shared command-center refresh below owns queue loading and revalidation.',start);
assert(start>=0&&end>start);const renderer=html.slice(start,end);
const dom=new JSDOM('<!doctype html><div id="integrityQueueSummary"></div><div id="integrityQueue"></div><button id="elsewhere">Elsewhere</button>',{url:'https://example.org/'}),document=dom.window.document;
const box=document.getElementById('integrityQueue'),summary=document.getElementById('integrityQueueSummary');
function elt(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
const context=vm.createContext({document,URL,elt,integrityQueueData:null,impactLedger:null,latestSenateEstimates:null});vm.runInContext(renderer,context);
const source={publisher:'Filed court document COPY',url:'https://example.org/order.pdf',case_number:'MECHANICAL-CASE',source_kind:'primary_document_copy_court_order',document_number:64,filed_date:'2026-10-30',retrieval_method:'reader_extracted_document_text',evidence_limit:'Reader text only. Original PDF request 403 STOP; no owned original PDF hash.'};
const reviewed={id:'mechanical-reviewed',title:'Mechanical procedural review',url:'https://example.org/news',publisher:'Mechanical newsroom',published_at:'2026-10-30T12:00:00Z',state_hints:['AK'],headline_numbers_unverified:[],review_status:'primary_source_checked',reviewed_as_of:'2026-10-30',primary_sources:[source],review_notes:'Document 64 grants expedited consideration only. Document 43 requests relief; it does not establish an allegation or remedy.',impact_counts_verified:false,promoted_to_incident_id:null};
const pending={...structuredClone(reviewed),id:'mechanical-pending',title:'A pending headline',review_status:'needs_primary_source',primary_sources:[],review_notes:undefined};
context.renderIntegrityQueue({updated_at:'2026-10-30T13:00:00Z',review_metrics:{advisory_related_headline_buckets:2},items:[reviewed,pending]});
assert.equal(box.querySelectorAll('.racecard').length,2);assert(summary.textContent.includes('1 news leads awaiting primary-source checks · 1 lead(s) source-checked'));
const disclosure=box.querySelector('details.integrity-source-review'),toggle=disclosure.querySelector('summary');
assert.equal(box.querySelectorAll('details').length,1,'Pending lead keeps its original compact card');
assert.equal(toggle.textContent,'Reviewed sources and limits');assert.equal(disclosure.open,false,'Long evidence is initially collapsed');
toggle.focus();assert.equal(document.activeElement,toggle,'Native summary is focusable without a custom key handler');toggle.click();assert.equal(disclosure.open,true,'Native summary activation opens the disclosure');
assert(disclosure.textContent.includes('Checked 2026-10-30 · Case MECHANICAL-CASE'));
assert(disclosure.textContent.includes('Copied-document TEXT review · not official-host or native-original authentication.'));
assert(disclosure.textContent.includes(source.evidence_limit));assert(disclosure.textContent.includes(reviewed.review_notes));
assert(disclosure.textContent.includes('Voter-impact counts are not verified'));assert(disclosure.textContent.includes('Not promoted to a curated incident.'));
const link=disclosure.querySelector('a');assert.equal(link.href,source.url);assert.equal(link.rel,'noopener noreferrer');assert.equal(link.target,'_blank');link.focus();assert.equal(document.activeElement,link);toggle.click();assert.equal(disclosure.open,false);
// Source fields are textContent, not markup. Unsupported URLs never become links.
const unsafe=structuredClone(reviewed);unsafe.title='<img src=x onerror="throw 1">';unsafe.primary_sources=[{...source,publisher:'<script>bad()</script>',url:'javascript:alert(1)',evidence_limit:'<img src=x>'},{...source,url:'https://name:secret@example.org/doc'},{...source,url:'http://example.org/plain'},{...source,url:'data:text/html,bad'}];unsafe.review_notes='<svg onload=bad()>literal limit</svg>';
context.renderIntegrityQueue({items:[unsafe]});assert.equal(box.querySelectorAll('details a').length,0);assert.equal(box.querySelectorAll('img,script,svg').length,0);assert(box.textContent.includes('<script>bad()</script>'));assert(box.textContent.includes('<svg onload=bad()>literal limit</svg>'));
const legacy={...reviewed,primary_sources:[{publisher:'Existing on-record source',url:'https://example.org/statement'}],promoted_to_incident_id:'existing-case'};
context.renderIntegrityQueue({items:[legacy]});assert(box.textContent.includes('Curated case reference: existing-case'));assert(!box.textContent.includes('Copied-document TEXT review'),'Legacy sources are not falsely relabelled copied or authenticated');
context.renderIntegrityQueue({items:[]});assert(box.textContent.includes('This does not mean no incidents occurred.'));
const thirteen=Array.from({length:13},(_,i)=>({...pending,id:'pending-'+i}));context.renderIntegrityQueue({items:thirteen});assert.equal(box.querySelectorAll('.racecard').length,12,'Original twelve-card bound remains');
assert(!/addEventListener|onkeydown|innerHTML|fetch\(/.test(renderer),'Native disclosure does not add key traps, markup injection or source retrieval');
if(candidate){const patch=JSON.parse(fs.readFileSync(path.join(ROOT,'index.integrity.patch.json'),'utf8'));let inverse=html;for(const op of patch.operations.slice().reverse()){assert.equal(inverse.split(op.after).length,2);inverse=inverse.replace(op.after,op.before);}assert.equal(inverse,fs.readFileSync(path.join(ROOT,'index.before-integrity.html'),'utf8'),'Every other page byte remains unchanged');}
dom.window.close();console.log(JSON.stringify({status:'PASS_ACTUAL_REVIEW_DISCLOSURE_DOM',native_summary_focus_and_activation:true,safe_text_and_URLs:true,original_pending_empty_twelve_card_contracts:true,browser_keyboard_or_geometry_claim:false,source_GETs:0,model_runs:0}));
