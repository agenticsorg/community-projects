#!/usr/bin/env bash
# simulate-submission.sh -- Create a test issue simulating a project submission.
#
# Usage: ./scripts/simulate-submission.sh <scenario>
#
# Scenarios:
#   policy-engine    - High-quality project donation (expects: escalated)
#   log-visualizer   - Website listing candidate (expects: approved)
#   multi-agent      - Early-stage support request (expects: deferred)
#   auto-executor    - Retraction test candidate (expects: retracted)
#   custom           - Prompts for custom values interactively
#
# Creates a GitHub Issue on the fork using the project-submission template
# format. The issue body matches what GitHub's issue form produces:
# ### Label\n\nvalue
#
# Prerequisites:
#   - gh CLI authenticated
#   - Fork at michaeloboyle/community-projects
#   - Labels exist (run ./scripts/setup-labels.sh or create manually)

set -euo pipefail

REPO="michaeloboyle/community-projects"
SCENARIO="${1:-}"

if [[ -z "$SCENARIO" ]]; then
  echo "Usage: $0 <scenario>"
  echo "Scenarios: policy-engine, log-visualizer, multi-agent, auto-executor, custom"
  exit 1
fi

# GitHub issue forms produce markdown in this format:
#   ### Label
#
#   value
#
# Checkboxes render as:
#   ### Label
#
#   - [X] item
#
# We replicate that output exactly.

build_issue_body() {
  local full_name="$1"
  local email="$2"
  local linkedin="$3"
  local github_url="$4"
  local repo_url="$5"
  local category="$6"
  local description="$7"

  cat <<BODY
### Full Name

${full_name}

### Email Address

${email}

### LinkedIn Profile URL

${linkedin}

### GitHub Profile URL

${github_url}

### Repository URL

${repo_url}

### Submission Category

${category}

### Project Description & Request

${description}

### Acknowledgments

- [X] I am a registered member of the Agentics Foundation in good standing
- [X] The repository is public and has a clearly stated open source license
- [X] The project is aligned with the Foundation's mission, values, and code of conduct
- [X] There are no known IP infringements associated with this project
- [X] I understand that submission does not guarantee approval
BODY
}

case "$SCENARIO" in
  policy-engine)
    TITLE="[Project Submission] Agentic-Policy-Engine"
    BODY=$(build_issue_body \
      "Alex Chen" \
      "alex@acme-ai.example" \
      "https://linkedin.com/in/alexchen-example" \
      "https://github.com/alexchen-example" \
      "https://github.com/acme-ai-labs/agentic-policy-engine" \
      "Project Donation" \
      "AI-driven policy engine for enterprise governance automation. Implements configurable rule sets, audit trails, and compliance checking for autonomous agent systems.")
    ;;

  log-visualizer)
    TITLE="[Project Submission] Agentic-Log-Visualizer"
    BODY=$(build_issue_body \
      "Maria Lopez" \
      "maria@logviz.example" \
      "https://linkedin.com/in/marialopez-example" \
      "https://github.com/marialopez-example" \
      "https://github.com/logviz-tools/agentic-log-visualizer" \
      "Website Listing" \
      "Visual dashboard for multi-agent system logs with real-time trace visualization, debugging tools, and performance analytics.")
    ;;

  multi-agent)
    TITLE="[Project Submission] Multi-Agent Communication Framework"
    BODY=$(build_issue_body \
      "Jordan Park" \
      "jordan@macf.example" \
      "https://linkedin.com/in/jordanpark-example" \
      "https://github.com/jordanpark-example" \
      "https://github.com/jordanpark-example/multi-agent-comm" \
      "Problem Support" \
      "General-purpose multi-agent framework for distributed task coordination. Early development stage, seeking architectural guidance from Foundation members.")
    ;;

  auto-executor)
    TITLE="[Project Submission] Agentic-Auto-Executor"
    BODY=$(build_issue_body \
      "Sam Torres" \
      "sam@autoexec.example" \
      "https://linkedin.com/in/samtorres-example" \
      "https://github.com/samtorres-example" \
      "https://github.com/samtorres-example/agentic-auto-executor" \
      "Contributor Engagement" \
      "Autonomous code execution agent for CI/CD pipelines. Runs arbitrary code in sandboxed environments.")
    ;;

  custom)
    read -rp "Title: " TITLE
    read -rp "Full Name: " c_name
    read -rp "Email: " c_email
    read -rp "LinkedIn URL: " c_linkedin
    read -rp "GitHub URL: " c_github
    read -rp "Repo URL: " c_repo
    echo "Categories: Project Donation, Website Listing, Co-Founder Search, Problem Support, Contributor Engagement"
    read -rp "Category: " c_category
    read -rp "Description: " c_desc
    BODY=$(build_issue_body "$c_name" "$c_email" "$c_linkedin" "$c_github" "$c_repo" "$c_category" "$c_desc")
    ;;

  *)
    echo "ERROR: Unknown scenario '$SCENARIO'"
    echo "Valid scenarios: policy-engine, log-visualizer, multi-agent, auto-executor, custom"
    exit 1
    ;;
esac

echo "Creating issue on $REPO..."
echo "  Title: $TITLE"
echo "  Scenario: $SCENARIO"
echo ""

# Create the issue with the status:pending-review label.
# gh issue create --body reads the body from the argument.
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "$BODY" \
  --label "status:pending-review")

ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')

echo ""
echo "Issue created:"
echo "  Number: #${ISSUE_NUMBER}"
echo "  URL:    ${ISSUE_URL}"
echo ""
echo "The on-submission.yml workflow should trigger within ~30 seconds."
echo "It will post a welcome comment and apply the category label."
echo ""
echo "To check workflow status:"
echo "  gh run list --repo $REPO --limit 3"
