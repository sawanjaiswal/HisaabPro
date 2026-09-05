fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android build

```sh
[bundle exec] fastlane android build
```

Build the signed release AAB

### android internal

```sh
[bundle exec] fastlane android internal
```

Upload to Internal Testing track

### android alpha

```sh
[bundle exec] fastlane android alpha
```

Upload to Closed Testing (alpha) track

### android closed

```sh
[bundle exec] fastlane android closed
```

Upload to Closed Testing (alias for alpha)

### android production

```sh
[bundle exec] fastlane android production
```

Upload to Production track

### android upload_to_track

```sh
[bundle exec] fastlane android upload_to_track
```

Generic track upload helper

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
