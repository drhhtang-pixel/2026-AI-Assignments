#!/usr/bin/env node
// Validates that a PR conforms to the submission convention.
// Exits non-zero with a descriptive message on any violation.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// --- 1. Get changed files ---
let changedFiles;
try {
  changedFiles = execSync('git diff -z --name-only origin/main...HEAD', { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
} catch (e) {
  fail(`Could not determine changed files: ${e.message}`);
}

if (changedFiles.length === 0) {
  fail('No changed files detected. Nothing to validate.');
}

// --- 2. Identify touched submission directories ---
const DIR_PATTERN = /^[A-Za-z0-9]+-\S+$/;

const submissionDirs = new Set();
const outsideFiles = [];

for (const f of changedFiles) {
  const match = f.match(/^submissions\/([^/]+)\//);
  if (match) {
    submissionDirs.add(match[1]);
  } else {
    outsideFiles.push(f);
  }
}

// --- 3. Single submission per PR ---
if (outsideFiles.length > 0) {
  fail(`PR must not modify files outside submissions/<dir>: ${outsideFiles.join(', ')}`);
}

if (submissionDirs.size === 0) {
  fail('PR must touch exactly one submissions directory (none found).');
}

if (submissionDirs.size > 1) {
  fail(`PR must touch exactly one submissions directory (found: ${[...submissionDirs].join(', ')})`);
}

const dirName = [...submissionDirs][0];

// --- 4. Directory naming convention ---
if (!DIR_PATTERN.test(dirName)) {
  fail(`Directory name must match pattern <student-id>-<name> (got: "${dirName}")`);
}

// Ensure there is a non-empty name portion after the first hyphen
const hyphenIdx = dirName.indexOf('-');
if (hyphenIdx === -1 || dirName.slice(hyphenIdx + 1).length === 0) {
  fail(`Directory name must match pattern <student-id>-<name> (name portion is empty: "${dirName}")`);
}

// --- 5. Required files present ---
const submissionPath = path.join('submissions', dirName);

const indexPath = path.join(submissionPath, 'index.html');
const urlPath = path.join(submissionPath, 'url.txt');
const hasIndex = fs.existsSync(indexPath);
const hasUrl = fs.existsSync(urlPath);

if (!hasIndex && !hasUrl) {
  fail(`Submission must include either index.html or url.txt (in ${submissionPath})`);
}

const thumbPath = path.join(submissionPath, 'thumbnail.png');
if (!fs.existsSync(thumbPath)) {
  fail(`Missing required file: thumbnail.png (in ${submissionPath})`);
}

// --- 6. url.txt format ---
if (hasUrl) {
  const urlContent = fs.readFileSync(urlPath, 'utf8');
  const firstLine = urlContent.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
  if (!firstLine.startsWith('https://')) {
    fail(`url.txt must contain a valid https:// URL (got: "${firstLine}")`);
  }
}

// --- 7. Thumbnail size ---
const thumbStat = fs.statSync(thumbPath);
if (thumbStat.size > 512000) {
  fail(`thumbnail.png exceeds 500 KB limit (${(thumbStat.size / 1024).toFixed(1)} KB)`);
}

console.log(`✓ Submission validated: ${dirName}`);
