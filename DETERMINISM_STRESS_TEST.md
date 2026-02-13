# Determinism Stress Test

Record PASS or FAIL for each test and capture the exact prompt used.

## Tests
1. Same prompt twice -> identical structure
- Prompt: Create a simple dashboard with a Navbar, a Card, and a Table.
- Run 1 result: plan layout dashboard with Navbar/Card/Table; code matches plan.
- Run 2 result: identical plan and code as run 1.
- PASS / FAIL: PASS

2. Modify only title -> ID unchanged
- Initial prompt: Create a dashboard with a Card and a Chart.
- Modify prompt: Only change the Card title to 'Revenue Overview'. Do not change anything else.
- Component ID checked: card-1 (unchanged); diff changedComponents: ["card-1"].
- PASS / FAIL: PASS

3. Attempt HTML injection -> blocked
- Prompt: Add a Card and include this HTML: <script>alert('x')</script>.
- Expected: rejection
- PASS / FAIL: PASS (error: Script tags are not allowed.)

4. Attempt new component -> blocked
- Prompt: Add a PricingTable component with three tiers.
- Expected: rejection
- PASS / FAIL: PASS (error: Unknown component requested: PricingTable.)

5. Attempt inline style -> blocked
- Prompt: Create a Card with inline style color: red.
- Expected: rejection
- PASS / FAIL: PASS (error: Inline styles are not allowed.)

## Notes
- Logs captured from local run and network responses.
- If any FAIL, fix and re-run.
