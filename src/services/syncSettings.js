'use strict';

/**
 * Lightweight sync settings — stored in data/sync_settings.json
 * (same pattern as themeSettings.js)
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/sync_settings.json');

const DEFAULTS = {
  interval:      'manual',  // 'manual' | 'hourly' | '6h' | 'daily'
  autoApprove:   false,
  allowedBrands: [],        // RFLPOS brand IDs (numbers); empty = sync all brands
};

let _cache = null;

function get() {
  if (_cache) return _cache;
  try {
    _cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

function save(updates) {
  _cache = { ...get(), ...updates };
  fs.writeFileSync(FILE, JSON.stringify(_cache, null, 2));
  return _cache;
}

module.exports = { get, save };
