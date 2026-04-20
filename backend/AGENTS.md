# AGENTS.md – Hackathon Actuarial Provisioning System

## Mission

Build a production-grade, automated actuarial provisioning system for an insurance portfolio.
The goal is not just correct calculations — it is a robust, traceable, auditable, industrial system.

## Scoring Weights (shape every decision around this)

| Criterion                                                                      | Pts |
| ------------------------------------------------------------------------------ | --- |
| Actuarial accuracy (correct results per product/portfolio, method consistency) | 30  |
| Technical architecture (modularity, performance)                               | 20  |
| Automation & robustness (error handling, cleaning, reproducibility)            | 15  |
| UI/UX (professional, readable, ergonomic)                                      | 10  |
| Traceability & auditability (logs, visible assumptions)                        | 10  |
| Innovation (visualization, optimization)                                       | 10  |
| Documentation                                                                  | 5   |

## Source of Truth

- `./data/` — raw input data. **NEVER MODIFY. READ ONLY.**
- `HACKATHON_FOUNDATION_COMPLETE.md` — summary of mentor documents.
  - Sections marked **FACT**: direct summaries, treat as reliable.
  - Sections marked **SUGGESTED**: LLM-generated proposals, verify before implementing.
  - When in doubt, **ask a mentor** (see Mentor Policy below).

## Tech Stack

- **Python** exclusively. Venv: `/home/maab/Documents/openData/.venv/bin/python`
- Install missing packages with:
  `/home/maab/Documents/openData/.venv/bin/python -m pip install <package>`
- UI: [Streamlit / Dash — confirm and fill in]
- Export: openpyxl (Excel), reportlab or weasyprint (PDF)

## Project Structure

data/                        # RAW, READ ONLY
src/
session_logs/  	# USE DATE_TIMESTAMP
AGENTS.md
HACKATHON_FOUNDATION_COMPLETE.md

## Architecture Rules

1. **One file per provision module.** Each module must be independently runnable and testable.
2. **Orchestrator owns execution order.** Modules must not call each other directly — all
   inter-provision dependencies go through the orchestrator.
3. **No hardcoded values.** All thresholds, rates, and legislative constants (e.g. the 72% PE
   rate) must be in a config file or admin-adjustable UI parameter.
4. **Inputs and outputs of each module must be explicitly typed and logged.**

## Code Quality Standards

Every function must have:

- Type hints on all arguments and return values
- A docstring (one-liner minimum, full for complex logic)
- Logging via the standard `logging` module (not `print`)
- Exception handling with meaningful error messages

Log levels:

- `DEBUG` — intermediate calculation steps
- `INFO` — module start/end, key results
- `WARNING` — data anomalies detected but handled
- `ERROR` — unrecoverable issues

## Data Cleaning (assume human input = human mistakes)

Check for and handle:

- Missing values (document imputation strategy per field, do not silently drop)
- Wrong date formats (normalize everything to ISO 8601)
- Negative values where impossible (flag, log, reject or clamp with justification)
- Duplicate rows
- Type mismatches (e.g. strings in numeric columns)
- Encoding issues in CSV files
- Portfolio/product label inconsistencies (e.g. "AUTO" vs "Auto" vs "auto")

All cleaning steps must be logged and summarized in a cleaning report included in the final output.

## Actuarial Notes (from instructors)

- **IBNR / Chain Ladder:** Requires homogeneity of variables for the Law of Large Numbers to hold.
  Car insurance and life insurance have different means — **they must not be mixed in the same
  triangle.** Segment triangles by line of business before applying Chain Ladder.
- **Provision d'Égalisation (PE) – Assurance Groupe:** Formula is fixed by Algerian legislation.
  The 72% coefficient must be **admin-configurable** in the UI, to accommodate future legislative
  changes without code modification.

## Mentor Policy

We have access to actuarial mentors. **Use them aggressively.**
Flag any of the following immediately and formulate a precise question:

- Ambiguity in a formula or method
- Suspected error or contradiction in the foundation document
- A SUGGESTED section you want to validate before implementing
- Any assumption you are about to hardcode

Format mentor questions as:

> **Context:** [what you are building]
> **Ambiguity:** [exactly what is unclear]
> **Your current assumption:** [what you would do without their input]
> **Question:** [one specific question]

## Differentiation Strategy (what teammates will likely miss)

Focus effort here to stand out:

1. **Full audit trail:** every provision result must be traceable back to input rows and
   intermediate steps. Export as a separate audit sheet in Excel and as logs.
2. **Configurable legislative parameters:** admin panel in UI for constants like the PE 72% rate.
3. **Cleaning report:** visible summary of every data anomaly found and how it was handled.
4. **Per-product breakdown:** results disaggregated by product/portfolio, not just totals.
5. **Assumption registry:** a visible table in the dashboard listing every assumption made,
   its source (legislation / mentor instruction / LLM suggestion), and its current value.

## Session Protocol

At the start of each session:

1. Read this file.
2. Read the latest file in `docs/session_logs/`.
3. Confirm which module you are working on before writing any code.

At the end of each session, create `docs/session_logs/YYYY-MM-DD.md` containing:

- What was implemented or changed
- Any open questions for mentors
- Any SUGGESTED sections in the foundation doc that were acted on
- Known issues or TODOs
