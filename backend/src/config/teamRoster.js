/**
 * Team Roster - Email to Role/Department/Permissions Mapping
 *
 * Sourced from the repo-root CLAUDE.md "Team Members (18 total)" table.
 * Used by the Google sign-in flow to assign app roles to verified Google
 * accounts without needing a database.
 *
 * App role mapping (from CLAUDE.md role strings):
 *   - "Backend Lead" / "Full Stack Lead" / "Tech Lead"     -> admin     ['read','write','admin']
 *   - "Solution Architect" / "Product Owner"               -> manager   ['read','write']
 *   - "Backend Dev" / "Frontend Dev" / "Full Stack Dev"    -> developer ['read','write']
 *   - "QA"                                                 -> viewer    ['read']
 *
 * Department: inferred from role family.
 *   - Engineering: devs/leads/architects
 *   - Product:     POs
 *   - Quality:     QA
 */

const ADMIN_PERMS = ['read', 'write', 'admin'];
const MANAGER_PERMS = ['read', 'write'];
const DEV_PERMS = ['read', 'write'];
const VIEWER_PERMS = ['read'];

const TEAM_ROSTER = {
  'kapatinya@central.co.th': {
    name: 'Patinya Kaewsrithong',
    role: 'admin',
    department: 'Engineering',
    permissions: ADMIN_PERMS,
  },
  'sasarayoot@central.co.th': {
    name: 'Sarayoot Sanboonreung',
    role: 'admin',
    department: 'Engineering',
    permissions: ADMIN_PERMS,
  },
  'thphantharanun@central.co.th': {
    name: 'Phantharanun Thongasa',
    role: 'manager',
    department: 'Engineering',
    permissions: MANAGER_PERMS,
  },
  'wapitthawat@central.co.th': {
    name: 'Pitthawat Wajeethongrattanaa',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'wathanapat@central.co.th': {
    name: 'Thanapat Waewsri',
    role: 'manager',
    department: 'Engineering',
    permissions: MANAGER_PERMS,
  },
  'phnatajrak@central.co.th': {
    name: 'Natajrak Phuphatsirikorn',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'wonaruechon@central.co.th': {
    name: 'Naruechon Woraphatphawan',
    role: 'manager',
    department: 'Product',
    permissions: MANAGER_PERMS,
  },
  'thpunnapa@central.co.th': {
    name: 'Punnapa Thianchai',
    role: 'manager',
    department: 'Product',
    permissions: MANAGER_PERMS,
  },
  'bokanate@central.co.th': {
    name: 'Kanate Boonsiri',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'intawatchai@central.co.th': {
    name: 'Tawatchai Insree',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'sathanapoom@central.co.th': {
    name: 'Thanapoom Sae-Tiew',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'tachongrak@central.co.th': {
    name: 'Chongrak Tanaka',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'suthossaporn@central.co.th': {
    name: 'Thossaporn Sukprasomjit',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'prsupasek@central.co.th': {
    name: 'Supasek Prajaksuvitee',
    role: 'admin',
    department: 'Engineering',
    permissions: ADMIN_PERMS,
  },
  'klteerapat@central.co.th': {
    name: 'Teerapat Klongklaew',
    role: 'manager',
    department: 'Engineering',
    permissions: MANAGER_PERMS,
  },
  'anwisit@central.co.th': {
    name: 'Wisit Anusitwiwat',
    role: 'developer',
    department: 'Engineering',
    permissions: DEV_PERMS,
  },
  'hasiriya@central.co.th': {
    name: 'Siriya Hacha',
    role: 'viewer',
    department: 'Quality',
    permissions: VIEWER_PERMS,
  },
  'titonnakorn@central.co.th': {
    name: 'Tonnakorn Tiensermpong',
    role: 'viewer',
    department: 'Quality',
    permissions: VIEWER_PERMS,
  },
};

/**
 * Look up a roster entry by email (case-insensitive).
 * @param {string} email
 * @returns {{name:string, role:string, department:string, permissions:string[]}|null}
 */
function getRosterEntry(email) {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return TEAM_ROSTER[normalized] || null;
}

module.exports = {
  TEAM_ROSTER,
  getRosterEntry,
};
