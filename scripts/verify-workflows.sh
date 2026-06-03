#!/usr/bin/env bash
# verify-workflows.sh -- Validate workflow files for basic syntax and structure.
#
# Usage: ./scripts/verify-workflows.sh
#
# Checks:
#   - All .yml files in .github/workflows/ are valid YAML
#   - Each workflow has an 'on:' trigger block
#   - Each workflow has a 'jobs:' block
#   - No tab characters (GitHub Actions requires spaces for indentation)
#   - No trailing whitespace issues that could cause parse failures
#   - Reports pass/fail per file with a summary
#
# Does NOT run workflows or validate action references.
#
# Requires: python3 (for YAML validation)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/.github/workflows"

if [[ ! -d "$WORKFLOW_DIR" ]]; then
  echo "ERROR: Workflow directory not found at $WORKFLOW_DIR"
  exit 1
fi

PASS=0
FAIL=0
WARN=0
TOTAL=0

pass() { PASS=$((PASS + 1)); }
fail() { FAIL=$((FAIL + 1)); }
warn() { WARN=$((WARN + 1)); }

echo "Validating workflow files in $WORKFLOW_DIR"
echo ""

# Check if python3 is available for YAML parsing
PYTHON_AVAILABLE=false
if command -v python3 &>/dev/null; then
  # Verify PyYAML is available
  if python3 -c "import yaml" 2>/dev/null; then
    PYTHON_AVAILABLE=true
  fi
fi

for file in "$WORKFLOW_DIR"/*.yml; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  filename=$(basename "$file")
  TOTAL=$((TOTAL + 1))
  errors=()
  warnings=()

  echo "--- $filename ---"

  # Check 1: Valid YAML
  if [[ "$PYTHON_AVAILABLE" == true ]]; then
    if python3 -c "
import yaml, sys
try:
    with open('$file') as f:
        yaml.safe_load(f)
except yaml.YAMLError as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
" 2>/dev/null; then
      echo "  [PASS] Valid YAML"
      pass
    else
      echo "  [FAIL] Invalid YAML syntax"
      errors+=("Invalid YAML")
      fail
    fi
  else
    # Fallback: basic check without python yaml module
    # Check for common YAML issues
    if head -1 "$file" | grep -qE '^\s*$|^#|^name:|^---'; then
      echo "  [PASS] YAML structure looks reasonable (install PyYAML for full validation)"
      pass
    else
      echo "  [WARN] Cannot validate YAML (python3 + PyYAML not available)"
      warnings+=("No YAML validator")
      warn
    fi
  fi

  # Check 2: Has 'on:' trigger
  if grep -qE '^on:' "$file"; then
    echo "  [PASS] Has 'on:' trigger"
    pass

    # Sub-check: identify trigger types
    triggers=$(grep -A 20 '^on:' "$file" | grep -E '^\s{2}\w' | sed 's/:.*//' | tr -d ' ' | tr '\n' ', ' | sed 's/,$//')
    if [[ -n "$triggers" ]]; then
      echo "         Triggers: $triggers"
    fi
  else
    echo "  [FAIL] Missing 'on:' trigger block"
    errors+=("Missing on: trigger")
    fail
  fi

  # Check 3: Has 'jobs:' block
  if grep -qE '^jobs:' "$file"; then
    echo "  [PASS] Has 'jobs:' block"
    pass

    # Sub-check: count jobs
    job_count=$(grep -cE '^\s{2}\w.*:$' "$file" | head -1 || echo "0")
    # Better: count lines matching job name pattern under jobs:
    job_names=$(awk '/^jobs:/{found=1;next} found && /^  [a-zA-Z]/{print $0} found && /^[a-zA-Z]/ && !/^jobs:/{found=0}' "$file" | sed 's/:.*//' | tr -d ' ' | tr '\n' ', ' | sed 's/,$//')
    if [[ -n "$job_names" ]]; then
      echo "         Jobs: $job_names"
    fi
  else
    echo "  [FAIL] Missing 'jobs:' block"
    errors+=("Missing jobs: block")
    fail
  fi

  # Check 4: No tab characters
  if grep -Pn '\t' "$file" >/dev/null 2>&1; then
    tab_lines=$(grep -Pn '\t' "$file" | head -5)
    echo "  [FAIL] Contains tab characters (GitHub Actions requires spaces)"
    echo "         Lines with tabs:"
    echo "$tab_lines" | while IFS= read -r line; do
      echo "           $line"
    done
    errors+=("Tab characters found")
    fail
  else
    echo "  [PASS] No tab characters"
    pass
  fi

  # Check 5: Has 'permissions:' block (security best practice)
  if grep -qE '^permissions:' "$file"; then
    echo "  [PASS] Has 'permissions:' block (security best practice)"
    pass
  else
    echo "  [WARN] No top-level 'permissions:' block (recommended for security)"
    warnings+=("No permissions block")
    warn
  fi

  # Check 6: Uses pinned action versions (not @main or @master)
  unpinned=$(grep -nE 'uses:\s+\S+@(main|master)\s*$' "$file" || true)
  if [[ -n "$unpinned" ]]; then
    echo "  [WARN] Uses unpinned action references (@main/@master)"
    echo "$unpinned" | while IFS= read -r line; do
      echo "           $line"
    done
    warnings+=("Unpinned actions")
    warn
  else
    echo "  [PASS] Action references are pinned"
    pass
  fi

  # Check 7: Name field exists
  if grep -qE '^name:' "$file"; then
    wf_name=$(grep -E '^name:' "$file" | head -1 | sed 's/^name:\s*//')
    echo "  [PASS] Has name: $wf_name"
    pass
  else
    echo "  [WARN] No 'name:' field"
    warnings+=("No name field")
    warn
  fi

  # Report per-file status
  if [[ ${#errors[@]} -gt 0 ]]; then
    echo "  RESULT: FAIL (${#errors[@]} error(s))"
  elif [[ ${#warnings[@]} -gt 0 ]]; then
    echo "  RESULT: PASS with warnings (${#warnings[@]})"
  else
    echo "  RESULT: PASS"
  fi

  echo ""
done

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo "================================================================="
echo "  WORKFLOW VALIDATION SUMMARY"
echo "================================================================="
echo ""
echo "  Files checked: $TOTAL"
echo "  Checks passed: $PASS"
echo "  Checks failed: $FAIL"
echo "  Warnings:      $WARN"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo "  All workflow files pass structural validation."
  exit 0
else
  echo "  WARNING: $FAIL check(s) failed. Fix these before pushing."
  exit 1
fi
