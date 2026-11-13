# Medication checks with fictional data (MA-05)

A signed-in patient opens **Medication Info** and chooses **Check my saved profile**.
The server loads that patient's saved Health Profile (MA-04) and runs four
deterministic checks against a small, versioned dataset of invented products,
ingredients, allergies, conditions and rules. The result says which **demo rules**
matched and what the demo dataset could not check. It is labelled **Fictional
demo** and never says a real combination is safe or unsafe. Real medication
questions belong with a pharmacist or clinician.

## The dataset

`backend/app/fixtures/medication_demo_rules.json`, version `1.0.0`
(`id: medassist-fictional-medication-rules`, `is_fictional: true`). It is validated
when it loads: IDs are unique, every reference resolves, interaction rules name
exactly two ingredients, and there is one duplicate rule and one allergy rule.

| Kind | Records |
| --- | --- |
| Products (ID: ingredients) | `prd-brivanol-250` Brivanol 250 tablets: brivanol · `prd-coldaway-day` Coldaway Day Relief: brivanol, fendrazine · `prd-coldaway-night` Coldaway Night Relief: dorvamide, fendrazine · `prd-sulvaxin` Sulvaxin capsules: sulvaxin · `prd-teromide` Teromide tablets: teromide · `prd-pexilene` Pexilene tablets: pexilene · `prd-velorin` Velorin: quellin |
| Allergies | `alg-sulvaxin-group` Sulvaxin-group sensitivity (sulvaxin) · `alg-brivanol` Brivanol sensitivity (brivanol) · `alg-pollen-x` Sample pollen X (no medicine ingredients) |
| Conditions | `cnd-k` Condition K · `cnd-q` Sample condition Q · `cnd-m` Condition M |

| Rule | Check | Matches when |
| --- | --- | --- |
| `DEMO-DUP-001` | Duplicate ingredient | Two recorded medicines share an ingredient |
| `DEMO-ALG-001` | Ingredient and allergy | A recorded medicine has an ingredient listed under a recorded allergy |
| `DEMO-INT-001` | Medicine pair | One medicine has teromide and another has pexilene |
| `DEMO-INT-002` | Medicine pair | One medicine has fendrazine and another has quellin |
| `DEMO-CND-001` | Medicine and condition | A medicine with pexilene and the condition Condition K |
| `DEMO-CND-002` | Medicine and condition | A medicine with dorvamide and the condition Condition M |

To change the data, edit the JSON, raise `version`, and update the tests in
`backend/tests/test_medication_rules.py`.

## How entries are matched

A saved entry matches a record when, ignoring case and extra spaces, it equals that
record's **fixture ID**, **name** or one of its listed **aliases**. There is no fuzzy
matching. The entry is then:

- **recognised**: exactly one record matches;
- **ambiguous**: several records match (for example `Coldaway` could be Day or
  Night Relief), returned with the candidate names;
- **unknown**: nothing matches (for example `Calmora syrup`).

Ambiguous and unknown entries are returned for review and never guessed.

## Outcome

| `outcome` | Shown as | When |
| --- | --- | --- |
| `matches_found` | "N demo rules matched" | At least one rule matched. `complete` may still be `false`. |
| `no_matching_rules` | **No matching demo rules** | Every section recorded (or "none") and every entry recognised, and no rule matched |
| `more_information_needed` | **More information needed** | No rule matched, and something could not be checked |

`complete` is `false` when any entry is unresolved or any section is
`not_recorded`. A profile can therefore produce a warning **and** a coverage gap;
the screen then shows both. A section saved as "none" counts as covered. A section
"not recorded yet" does not: missing medicines affect all four checks, missing
allergies the allergy check, and missing conditions the condition check.

Pair warnings are reported once: medicines are sorted by fixture ID before pairs are
formed, so the same profile gives the same result whatever order the entries were
saved in.

## Endpoint

`GET /api/v1/me/medication-check`. It is read-only and needs a session; it has no
body and no parameters.

It reuses the MA-04 rules. The owner comes from the session cookie, query parameters
are refused (`400`), every response is `Cache-Control: no-store`, and a signed-out or
ended session gets `401` (`not_signed_in` / `session_expired`). Running the check
does not change the profile.

```json
{
  "fixture": {"id": "medassist-fictional-medication-rules", "version": "1.0.0", "is_fictional": true},
  "profile_version": 4,
  "outcome": "matches_found",
  "complete": false,
  "matches": [
    {
      "rule_id": "DEMO-DUP-001",
      "check": "duplicate_ingredient",
      "title": "Same ingredient in two recorded medicines",
      "explanation": "Two recorded medicines list the same invented ingredient in the demo dataset.",
      "entries": [
        {"section": "medicines", "entry": "Brivanol 250 tablets", "matched_id": "prd-brivanol-250", "matched_name": "Brivanol 250 tablets"},
        {"section": "medicines", "entry": "Coldaway Day Relief", "matched_id": "prd-coldaway-day", "matched_name": "Coldaway Day Relief"}
      ],
      "ingredients": ["brivanol"]
    }
  ],
  "unresolved": [{"section": "medicines", "entry": "Coldaway", "reason": "ambiguous", "candidates": ["Coldaway Day Relief", "Coldaway Night Relief"]}],
  "missing": [{"section": "conditions", "reason": "not_recorded", "affected_checks": ["medicine_condition"]}],
  "recognised": [ … ]
}
```

## Windows demonstration

Set up the backend, demo accounts and frontend as in the
[MA-04 walkthrough](HEALTH_PROFILE_API.md#windows-walkthrough-two-accounts) (run the
seed with `--reset-profiles` for a clean start). Then:

1. Sign in as Patient A at <http://127.0.0.1:5173/sign-in>. In **Health Profile**,
   choose "I take medicines" and add `Brivanol 250 tablets` and `Coldaway Day Relief`.
   Choose "No known allergies" and "No conditions to list", then save.
2. Open **Medication Info** and choose **Check my saved profile**. It shows "1 demo
   rule matched": `DEMO-DUP-001`, both entries and the invented ingredient brivanol.
3. Choose **Open Health Profile**, remove Coldaway Day Relief, save, return and choose
   **Check my saved profile**. It now shows **No matching demo rules**.
4. Add `Coldaway` as a medicine, and set Health conditions to "Not recorded yet". Save
   and run the check: **More information needed** lists the ambiguous entry and the
   unrecorded conditions, with a link back to the Health Profile.
5. In an InPrivate window, sign in as Patient B and run the check. B's own profile
   (Velorin, no known allergies, conditions not recorded) gives **More information
   needed**, with nothing from A's profile.

## Before a medication pilot

MA-06 pilots consultation listings only. Medication checks stay in **demo mode** on
the fictional dataset above. No setting in this repository can switch them to real
products. A separate medication pilot would need the following before release.
None of it exists yet.

1. **An appropriately licensed reference.** This means a drug and interaction
   knowledge base licensed for this use: displaying results to patients inside
   MedAssist, in India. Its licence terms, attribution, update schedule and
   withdrawal process need to be recorded the way `reuse_basis` is recorded for
   consultation sources. The fictional rules cannot be extended toward real
   products by hand.
2. **Documented coverage.** Record which products (Indian brand names and
   generics), ingredients, strengths, allergy classes and conditions the
   reference covers, which interaction and contraindication types the checks use,
   and how an entry the reference cannot match is reported. "More information
   needed" must stay distinct from "no matching rules", and neither may read as "safe".
3. **Clinical review.** A licensed pharmacist or clinician needs to sign off the
   rule selection, severity wording, patient-facing text and the instruction to
   consult a professional. They also need to agree a process for reporting and
   correcting errors. Results must still not be presented as diagnosis or
   prescription.
4. **Privacy review.** Medicines, allergies and conditions are sensitive health data.
   The review should cover the lawful basis and consent under India's Digital
   Personal Data Protection Act 2023, data minimisation, retention, access logging,
   and whether any profile data would reach the reference provider (it should not
   leave MedAssist).
5. **Security review.** This covers threat modelling of the check endpoint and the
   reference update path, the integrity of the imported reference (signed or hashed
   versions, as the consultation importer records SHA-256), production-grade
   sign-in hardening (rate limits, recovery), and log checks like the ones in the
   full-stack workflow.
6. **Its own switch and fixture.** Like the consultation pilot, a medication pilot
   would need a server-side setting that is off by default, a fictional fixture for
   CI, and a visible label that says which data is in use.
