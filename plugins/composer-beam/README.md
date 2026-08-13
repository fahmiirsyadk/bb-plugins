# Composer Beam

<img width="100%" height="auto" alt="beam composer" src="https://github.com/user-attachments/assets/71f2eef7-14b8-4ec2-ac5d-591cd4ff650d" />

> based on [beam.jakubantalik.com](beam.jakubantalik.com)

Adds the animated beam around BB prompt composers while they are running or
submitting. The plugin is frontend-only and registers a bare banner through
`app.composer.customize`;

The banner uses the public composer view for run state, finds the containing
host prompt form through the composer slot DOM, and owns only its namespaced
attributes and bloom element. The motion geometry, timing, masks, gradients,
reduced-motion behavior, and 256 px visibility margin follow BB's current
composer beam. The colored BorderBeam palette and neutral white bloom are
retained as intrinsic visual presets.

Run the checks from this directory with:

```sh
npm run typecheck
npm test
npm run build
```
