'use strict';
// Capture-only adapter: reuse the production identity/count/freshness contract.
const fs = require('node:fs');
const source = require('./wisconsin_house_county_source.js').forRace('PA-10');
const reference = require('../data/pennsylvania_house_10_county_fips_reference.json');
const parsed = source.parse(JSON.parse(fs.readFileSync(0, 'utf8')), reference);
if (!parsed.live_votes_accepted) throw Error('No validated live counts');
const county = parsed.counties.find(c => c.county_fips === '42043');
if (!county || county.dem_votes + county.rep_votes === 0) throw Error('No Dauphin D/R counts');
process.stdout.write(JSON.stringify({dem: county.dem_votes, rep: county.rep_votes}));
