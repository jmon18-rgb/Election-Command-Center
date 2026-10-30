'use strict';
// One explicitly supplied local package. No discovery, downloads or model invocation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{inspect}=require('./historical_evaluation_package_preflight.cjs');
assert(process.argv.length===3,'Usage: node scripts/preflight_historical_evaluation_package.cjs <local-package-manifest.json>');
const file=fs.realpathSync(process.argv[2]),root=path.dirname(file),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const answer=inspect(manifest,{readBytes:relative=>{const actual=fs.realpathSync(path.resolve(root,relative)),within=path.relative(root,actual);assert(within&&!within.startsWith('..'+path.sep)&&within!=='..'&&!path.isAbsolute(within),'Artifact must remain inside the supplied package directory');return fs.readFileSync(actual);}});
console.log(JSON.stringify(answer,null,2));process.exitCode=answer.blocking_fields.length?2:0;
