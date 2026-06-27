// Enforces the canonical tax-rule spec against its implementations.
// If this fails: the spec md and the code disagree. Fix the code to match the spec
// (or, if the spec is wrong, fix the spec — and bump `last_verified` + add a verification-log entry).

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { rules as rules2024 } from '../Calculator/rules/2024.ts';
import { rules as rules2025 } from '../Calculator/rules/2025.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const readSpec = (slug: string) => readFileSync(join(here, `${slug}.md`), 'utf8');

const extractJsonBlock = (md: string, sectionHeader: string): unknown => {
  const re = new RegExp(`${sectionHeader}[\\s\\S]*?\`\`\`json\\n([\\s\\S]*?)\\n\`\`\``);
  const match = md.match(re);
  if (!match) throw new Error(`No json block found under "${sectionHeader}"`);
  return JSON.parse(match[1]);
};

const extractWorkedExampleIds = (md: string): string[] => {
  const re = /## Worked examples[\s\S]*?(?=\n## )/;
  const section = md.match(re)?.[0];
  if (!section) throw new Error('No "Worked examples" section');
  // Rows look like: `| `id` | Scenario | Expected |`
  const ids: string[] = [];
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|/);
    if (m) ids.push(m[1]);
  }
  return ids;
};

const checklistRegistersSpec = (specSlug: string): boolean => {
  const checklist = readFileSync(join(repoRoot, 'Intake/checklist.md'), 'utf8');
  return new RegExp(`tax-rule:\\s*\`${specSlug}\``).test(checklist);
};

describe('tax-rule/soldier-39a — drift checks', () => {
  const md = readSpec('soldier-39a');

  describe('year-values match TS rule tables', () => {
    const canonical = extractJsonBlock(md, '## Year values') as Record<string, unknown>;

    it('2024 soldier_points matches spec', () => {
      assert.deepStrictEqual(rules2024.soldier_points.value, canonical['2024']);
    });

    it('2025 soldier_points matches spec', () => {
      assert.deepStrictEqual(rules2025.soldier_points.value, canonical['2025']);
    });
  });

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    // Checklist references the spec by filename slug (the value the intake walker
    // uses to read `tax-rule/<slug>.md`), not the frontmatter `slug:` field.
    assert.ok(
      checklistRegistersSpec('soldier-39a'),
      'Intake/checklist.md has no line with tax-rule: `soldier-39a`',
    );
  });
});

describe('tax-rule/degree-40c-40d — drift checks', () => {
  const md = readSpec('degree-40c-40d');

  describe('year-values match TS rule tables', () => {
    const canonical = extractJsonBlock(md, '## Year values') as Record<string, unknown>;

    it('2024 degree_points matches spec', () => {
      assert.deepStrictEqual(rules2024.degree_points.value, canonical['2024']);
    });

    it('2025 degree_points matches spec', () => {
      assert.deepStrictEqual(rules2025.degree_points.value, canonical['2025']);
    });
  });

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('degree-40c-40d'),
      'Intake/checklist.md has no line with tax-rule: `degree-40c-40d`',
    );
  });
});

describe('tax-rule/bituach-leumi-benefits-9 — drift checks', () => {
  // Bituach Leumi benefits is a classifier rule (which benefits feed the engine vs which are
  // statutorily exempt). No per-year value table — the §9 family classifier is
  // statute-driven and stable across the years we support. Drift contract:
  // worked-example tags + checklist registration only. See spec § Year values.
  const md = readSpec('bituach-leumi-benefits-9');

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('bituach-leumi-benefits-9'),
      'Intake/checklist.md has no line with tax-rule: `bituach-leumi-benefits-9`',
    );
  });
});

describe('tax-rule/settlement-11 — drift checks', () => {
  const md = readSpec('settlement-11');

  describe('year-values match TS rule tables', () => {
    // Drift contract is the year-level shared `settlement_rule.value` only
    // (`max_income_ceiling_nis` fallback). The per-settlement list lives in
    // `Calculator/rules/settlements/<YYYY>.ts` — too large to embed and audited
    // separately via Calculator/Tests/30 Questions/.
    const canonical = extractJsonBlock(md, '## Year values') as Record<string, unknown>;

    it('2024 settlement_rule matches spec', () => {
      assert.deepStrictEqual(rules2024.settlement_rule.value, canonical['2024']);
    });

    it('2025 settlement_rule matches spec', () => {
      assert.deepStrictEqual(rules2025.settlement_rule.value, canonical['2025']);
    });
  });

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('settlement-11'),
      'Intake/checklist.md has no line with tax-rule: `settlement-11`',
    );
  });
});

describe('tax-rule/secondary-102 — drift checks', () => {
  // §102 secondary is a CLASSIFICATION rule: it routes proceeds into the shared
  // `separate_rates` block and reads only the two capital-gains subfields (the
  // interest/dividend fields belong to a future capital-markets spec). So the
  // year-values drift contract compares just `capital_gains` +
  // `capital_gains_substantial`, not the whole `separate_rates.value`.
  const md = readSpec('secondary-102');

  describe('capital-gains rates match TS rule tables', () => {
    const canonical = extractJsonBlock(md, '## Year values') as Record<
      string,
      { capital_gains: number; capital_gains_substantial: number }
    >;

    it('2024 capital_gains rates match spec', () => {
      assert.equal(rules2024.separate_rates.value.capital_gains, canonical['2024'].capital_gains);
      assert.equal(
        rules2024.separate_rates.value.capital_gains_substantial,
        canonical['2024'].capital_gains_substantial,
      );
    });

    it('2025 capital_gains rates match spec', () => {
      assert.equal(rules2025.separate_rates.value.capital_gains, canonical['2025'].capital_gains);
      assert.equal(
        rules2025.separate_rates.value.capital_gains_substantial,
        canonical['2025'].capital_gains_substantial,
      );
    });
  });

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('secondary-102'),
      'Intake/checklist.md has no line with tax-rule: `secondary-102`',
    );
  });
});

describe('tax-rule/capital-gains-91-92 — drift checks', () => {
  // Canonical owner of the full `separate_rates` block (all six flat rates).
  // Drift contract compares the whole `separate_rates.value` (secondary-102 checks
  // only the two capital-gains subfields — a harmless narrower overlap).
  const md = readSpec('capital-gains-91-92');

  describe('year-values match TS rule tables', () => {
    const canonical = extractJsonBlock(md, '## Year values') as Record<string, unknown>;

    it('2024 separate_rates matches spec', () => {
      assert.deepStrictEqual(rules2024.separate_rates.value, canonical['2024']);
    });

    it('2025 separate_rates matches spec', () => {
      assert.deepStrictEqual(rules2025.separate_rates.value, canonical['2025']);
    });
  });

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('capital-gains-91-92'),
      'Intake/checklist.md has no line with tax-rule: `capital-gains-91-92`',
    );
  });
});

describe('tax-rule/multi-employer-121-164 — drift checks', () => {
  // §121/§164 has no per-year value table (engine aggregates generically over
  // employments[] — no rule_key). Drift contract: worked-example tags + checklist
  // registration only. See spec § Year values for rationale.
  const md = readSpec('multi-employer-121-164');

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('multi-employer-121-164'),
      'Intake/checklist.md has no line with tax-rule: `multi-employer-121-164`',
    );
  });
});

describe('tax-rule/donations-46 — drift checks', () => {
  const md = readSpec('donations-46');

  describe('year-values match TS rule tables', () => {
    const canonical = extractJsonBlock(md, '## Year values') as Record<string, unknown>;

    it('2024 donation matches spec', () => {
      assert.deepStrictEqual(rules2024.donation.value, canonical['2024']);
    });

    it('2025 donation matches spec', () => {
      assert.deepStrictEqual(rules2025.donation.value, canonical['2025']);
    });
  });

  describe('worked-example ids each have a matching test', () => {
    const ids = extractWorkedExampleIds(md);
    const testFile = readFileSync(
      join(repoRoot, 'Calculator/engine/calculate.test.ts'),
      'utf8',
    );

    it('spec lists at least one worked example', () => {
      assert.ok(ids.length > 0, 'no worked examples found in spec');
    });

    for (const id of ids) {
      it(`test exists for [${id}]`, () => {
        assert.ok(
          testFile.includes(`[${id}]`),
          `no test in calculate.test.ts contains tag [${id}]`,
        );
      });
    }
  });

  it('checklist registers this spec', () => {
    assert.ok(
      checklistRegistersSpec('donations-46'),
      'Intake/checklist.md has no line with tax-rule: `donations-46`',
    );
  });
});
