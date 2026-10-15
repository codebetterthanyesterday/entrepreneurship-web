# Photobooth API contract examples (v1)

Example bodies for the internal API the photobooth service calls. The
contract itself is in the photobooth repo, `docs/adr/003-main-app-contract.md`.

The same files live in the photobooth repo under `tests/fixtures/main-app-v1/`.
Tests on this side check that the endpoints produce this shape; tests on the
photobooth side check that its client accepts it. Change both copies together,
and only after changing the contract document.
