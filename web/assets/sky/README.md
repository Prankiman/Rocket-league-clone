# Skyboxes

`night-city.webp` is a 4096×2048 equirectangular panorama used as the default
outside-the-arena skyline.

- Source: [Poly Haven — Shanghai Bund](https://polyhaven.com/a/shanghai_bund)
- Author: Greg Zaal
- License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Derivative: Poly Haven's tonemapped JPG, resized to 4096×2048 and re-encoded
  as WebP (quality 86).

Players can replace the skybox at runtime with **Settings → Skybox image** by
uploading any equirectangular image. The upload is session-only and resets to
Night City on reload.

The source is a real night skyline rather than a Street View capture.
[streetview-dl](https://github.com/stiles/streetview-dl) needs a billed Google
Maps API key with the Map Tiles API enabled; without one, a CC0 panorama keeps
the game self-contained and license-clean.
