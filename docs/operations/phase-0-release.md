# Phase 0 release evidence

- Release owner: Product Owner and Technical Owner
- Required checks: database reset, pgTAP, formatting, lint, types, unit tests, production build, desktop/mobile auth smoke tests
- Defect threshold: zero blocker or critical defects; zero high-severity authorization, isolation, data-loss, or destructive-migration defects
- Rollback: disable newly introduced flags, redeploy the prior verified build, and use the recorded database restore point if forward recovery is unsafe
- Approval evidence: link the CI run, migration review, auth/RLS test results, alert test, and staging restore exercise