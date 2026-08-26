# The pipeline never runs a formatting stage

Every stage in the pipeline (`intent → rebase → review → test → document → lint → push → PR → CI`) either verifies or acts, but none of them rewrite source files as Prettier or similar would. This is a deliberate omission a reader would otherwise assume is a gap: formatting stays the responsibility of a pre-commit hook or editor integration, and checkpoint's `lint` stage only verifies rather than silently rewriting files a driver hasn't seen yet.
