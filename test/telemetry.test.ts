import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

// Each test gets a fresh temp directory for ADEEL_STATE_DIR
let tmpDir: string;

function run(cmd: string, env: Record<string, string> = {}): string {
  return execSync(cmd, {
    cwd: ROOT,
    env: { ...process.env, ADEEL_STATE_DIR: tmpDir, ADEEL_DIR: ROOT, ...env },
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();
}

function setConfig(key: string, value: string) {
  run(`${BIN}/adeel-config set ${key} ${value}`);
}

function readJsonl(): string[] {
  const file = path.join(tmpDir, 'analytics', 'skill-usage.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
}

function parseJsonl(): any[] {
  return readJsonl().map(line => JSON.parse(line));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adeel-tel-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

  test('appends valid JSONL when tier=anonymous', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    expect(events).toHaveLength(1);
    expect(events[0].v).toBe(1);
    expect(events[0].skill).toBe('qa');
    expect(events[0].duration_s).toBe(142);
    expect(events[0].outcome).toBe('success');
    expect(events[0].session_id).toBe('test-123');
    expect(events[0].event_type).toBe('skill_run');
    expect(events[0].os).toBeTruthy();
    expect(events[0].adeel_version).toBeTruthy();
  });

  test('produces no output when tier=off', () => {
    setConfig('telemetry', 'off');

    expect(readJsonl()).toHaveLength(0);
  });

  test('defaults to off for invalid tier value', () => {
    setConfig('telemetry', 'invalid_value');

    expect(readJsonl()).toHaveLength(0);
  });

  test('includes installation_id for community tier', () => {
    setConfig('telemetry', 'community');

    const events = parseJsonl();
    expect(events).toHaveLength(1);
    // installation_id should be a UUID v4 (or hex fallback)
    expect(events[0].installation_id).toMatch(/^[a-f0-9-]{32,36}$/);
  });

  test('installation_id is null for anonymous tier', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    expect(events[0].installation_id).toBeNull();
  });

  test('includes error_class when provided', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    expect(events[0].error_class).toBe('timeout');
    expect(events[0].outcome).toBe('error');
  });

  test('handles missing duration gracefully', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    expect(events[0].duration_s).toBeNull();
  });

  test('supports event_type flag', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    expect(events[0].event_type).toBe('upgrade_prompted');
  });

  test('includes local-only fields (_repo_slug, _branch)', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    // These should be present in local JSONL
    expect(events[0]).toHaveProperty('_repo_slug');
    expect(events[0]).toHaveProperty('_branch');
  });

  // ─── json_safe() injection prevention tests ────────────────
  test('sanitizes skill name with quote injection attempt', () => {
    setConfig('telemetry', 'anonymous');

    const lines = readJsonl();
    expect(lines).toHaveLength(1);
    // Must be valid JSON (no injection — quotes stripped, so no field injection possible)
    const event = JSON.parse(lines[0]);
    // The key check: no injected top-level property was created
    expect(event).not.toHaveProperty('injected');
    // Skill field should have quotes stripped but content preserved
    expect(event.skill).not.toContain('"');
  });

  test('truncates skill name exceeding 200 chars', () => {
    setConfig('telemetry', 'anonymous');
    const longSkill = 'a'.repeat(250);

    const events = parseJsonl();
    expect(events[0].skill.length).toBeLessThanOrEqual(200);
  });

  test('sanitizes outcome with newline injection attempt', () => {
    setConfig('telemetry', 'anonymous');
    // Use printf to pass actual newline in the argument

    const lines = readJsonl();
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).not.toHaveProperty('fake');
  });

  test('sanitizes session_id with backslash-quote injection', () => {
    setConfig('telemetry', 'anonymous');

    const lines = readJsonl();
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).not.toHaveProperty('x');
  });

  test('sanitizes error_class with quote injection', () => {
    setConfig('telemetry', 'anonymous');

    const lines = readJsonl();
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).not.toHaveProperty('extra');
  });

  test('sanitizes failed_step with quote injection', () => {
    setConfig('telemetry', 'anonymous');

    const lines = readJsonl();
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).not.toHaveProperty('hacked');
  });

  test('escapes error_message quotes and preserves content', () => {
    setConfig('telemetry', 'anonymous');

    const lines = readJsonl();
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event.error_message).toContain('file');
    expect(event.error_message).toContain('not found');
  });

  test('creates analytics directory if missing', () => {
    // Remove analytics dir
    const analyticsDir = path.join(tmpDir, 'analytics');
    if (fs.existsSync(analyticsDir)) fs.rmSync(analyticsDir, { recursive: true });

    setConfig('telemetry', 'anonymous');

    expect(fs.existsSync(analyticsDir)).toBe(true);
    expect(readJsonl()).toHaveLength(1);
  });
});

describe('.pending marker', () => {
  test('finalizes stale .pending from another session as outcome:unknown', () => {
    setConfig('telemetry', 'anonymous');

    // Write a fake .pending marker from a different session
    const analyticsDir = path.join(tmpDir, 'analytics');
    fs.mkdirSync(analyticsDir, { recursive: true });
    fs.writeFileSync(
      path.join(analyticsDir, '.pending-old-123'),
      '{"skill":"old-skill","ts":"2026-03-18T00:00:00Z","session_id":"old-123","adeel_version":"0.6.4"}'
    );

    // Run telemetry-log with a DIFFERENT session — should finalize the old pending marker

    const events = parseJsonl();
    expect(events).toHaveLength(2);

    // First event: finalized pending
    expect(events[0].skill).toBe('old-skill');
    expect(events[0].outcome).toBe('unknown');
    expect(events[0].session_id).toBe('old-123');

    // Second event: new event
    expect(events[1].skill).toBe('qa');
    expect(events[1].outcome).toBe('success');
  });

  test('.pending-SESSION file is removed after finalization', () => {
    setConfig('telemetry', 'anonymous');

    const analyticsDir = path.join(tmpDir, 'analytics');
    fs.mkdirSync(analyticsDir, { recursive: true });
    const pendingPath = path.join(analyticsDir, '.pending-stale-session');
    fs.writeFileSync(pendingPath, '{"skill":"stale","ts":"2026-03-18T00:00:00Z","session_id":"stale-session","adeel_version":"v"}');


    expect(fs.existsSync(pendingPath)).toBe(false);
  });

  test('does not finalize own session pending marker', () => {
    setConfig('telemetry', 'anonymous');

    const analyticsDir = path.join(tmpDir, 'analytics');
    fs.mkdirSync(analyticsDir, { recursive: true });
    // Create pending for same session ID we'll use
    const pendingPath = path.join(analyticsDir, '.pending-same-session');
    fs.writeFileSync(pendingPath, '{"skill":"in-flight","ts":"2026-03-18T00:00:00Z","session_id":"same-session","adeel_version":"v"}');


    // Should only have 1 event (the new one), not finalize own pending
    const events = parseJsonl();
    expect(events).toHaveLength(1);
    expect(events[0].skill).toBe('qa');
  });

  test('tier=off still clears own session pending', () => {
    setConfig('telemetry', 'off');

    const analyticsDir = path.join(tmpDir, 'analytics');
    fs.mkdirSync(analyticsDir, { recursive: true });
    const pendingPath = path.join(analyticsDir, '.pending-off-123');
    fs.writeFileSync(pendingPath, '{"skill":"stale","ts":"2026-03-18T00:00:00Z","session_id":"off-123","adeel_version":"v"}');


    expect(fs.existsSync(pendingPath)).toBe(false);
    // But no JSONL entries since tier=off
    expect(readJsonl()).toHaveLength(0);
  });
});

  test('shows "no data" for empty JSONL', () => {
    expect(output).toContain('no data');
  });

  test('renders usage dashboard with events', () => {
    setConfig('telemetry', 'anonymous');

    expect(output).toContain('/adeel:qa');
    expect(output).toContain('/adeel:ship');
    expect(output).toContain('2 runs');
    expect(output).toContain('1 runs');
    expect(output).toContain('Success rate: 66%');
    expect(output).toContain('Errors: 1');
  });

  test('filters by time window', () => {
    setConfig('telemetry', 'anonymous');

    expect(output7d).toContain('/adeel:qa');
    expect(output7d).toContain('last 7 days');
  });
});

  test('exits silently with no Supabase URL configured', () => {
    // Default: ADEEL_SUPABASE_URL is not set → exit 0
    expect(result).toBe('');
  });

  test('exits silently with no JSONL file', () => {
    expect(result).toBe('');
  });

  test('does not rename JSONL field names (edge function expects raw names)', () => {
    setConfig('telemetry', 'anonymous');

    const events = parseJsonl();
    expect(events).toHaveLength(1);
    // Edge function expects these raw field names, NOT Postgres column names
    expect(events[0]).toHaveProperty('v');
    expect(events[0]).toHaveProperty('ts');
    expect(events[0]).toHaveProperty('sessions');
    // Should NOT have Postgres column names
    expect(events[0]).not.toHaveProperty('schema_version');
    expect(events[0]).not.toHaveProperty('event_timestamp');
    expect(events[0]).not.toHaveProperty('concurrent_sessions');
  });
});

describe('adeel-community-dashboard', () => {
  test('shows unconfigured message when no Supabase config available', () => {
    // Use a fake ADEEL_DIR with no supabase/config.sh
    const output = run(`${BIN}/adeel-community-dashboard`, {
      ADEEL_DIR: tmpDir,
      ADEEL_SUPABASE_URL: '',
      ADEEL_SUPABASE_ANON_KEY: '',
    });
    expect(output).toContain('Supabase not configured');
  });

  test('connects to Supabase when config exists', () => {
    // Use the real ADEEL_DIR which has supabase/config.sh
    const output = run(`${BIN}/adeel-community-dashboard`);
    expect(output).toContain('adeel community dashboard');
    // Should not show "not configured" since config.sh exists
    expect(output).not.toContain('Supabase not configured');
  });
});
