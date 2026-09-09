# Runtime executor reports

First correction: record zero represented motion axes when the physical inline transform equals the authored base; retain raw CSS transform geometry. Added stripped-measurement test and realistic translated-measurement mock. Focused 31/31 tests passed; guard full 909/909 passed, but browser cases still failed.

Guard traced the remaining failure to physical `none` versus authored empty string. Browser-only normalized comparison gave exact cursor alignment with identical measurements. Second correction normalizes empty/none while requiring a present base callback; nonempty bases remain exact. Focused 33/33 tests passed. Browser tests and other pending files stayed unchanged. Guard then independently reproduced both previously RED browser cases passing on source dev server.

Both executor reports were relayed verbatim in the conversation. No executor browser/install/commit/planning writes.
