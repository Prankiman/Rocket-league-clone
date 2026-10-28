# Beckwith Park Lightweight · audio assets

Sound assets extracted from Rocket League, sourced from the public audio mirror at
https://github.com/ItsBranK/RocketLeague-Audio (Rocket League version 211123.48895.355454),
released under the Unlicense (see `LICENSE`). Only a small, curated subset relevant to
gameplay feedback is bundled.

| Mixer category | Local file | Upstream path |
| --- | --- | --- |
| Engine (idle loop) | `engines/SFX_Motor_OctaneMK2_0005.ogg` | `Motors/SFX_Motor_OctaneMK2/` |
| Engine (drive loop) | `engines/SFX_Motor_OctaneMK2_0008.ogg` | `Motors/SFX_Motor_OctaneMK2/` |
| Engine (supersonic jet loop) | `engines/SFX_VehicleElements_0004.ogg` | `Uncategorized/SFX_VehicleElements/` |
| Boost | `boosts/SFX_Boost_Standard_0001.ogg` | `Boosts/SFX_Boost_Standard/` |
| Boost | `boosts/SFX_Boost_Standard_0003.ogg` | `Boosts/SFX_Boost_Standard/` |
| Ball (soft deep touch) | `impacts/SFX_Impacts_0217.ogg` | `Uncategorized/SFX_Impacts/` |
| Ball (medium thud) | `impacts/SFX_Impacts_0001.ogg` | `Uncategorized/SFX_Impacts/` |
| Ball (hard impact) | `impacts/SFX_Impacts_0055.ogg` | `Uncategorized/SFX_Impacts/` |
| Impacts | `movements/SFX_Car_Movements_0001.ogg` | `Uncategorized/SFX_Car_Movements/` |
| Impacts | `movements/SFX_Car_Movements_0013.ogg` | `Uncategorized/SFX_Car_Movements/` |
| Impacts | `movements/SFX_Car_Movements_0015.ogg` | `Uncategorized/SFX_Car_Movements/` |
| Impacts | `knockouts/SFX_Knockout_0001.ogg` | `Uncategorized/SFX_Knockout/` |
| Impacts | `knockouts/SFX_Knockout_0002.ogg` | `Uncategorized/SFX_Knockout/` |
| Goal | `goal-explosions/SFX_GoalExplosion_NewDefault_0001.ogg` | `GoalExplosions/SFX_GoalExplosion_NewDefault/` |
| Goal | `goal-events/SFX_GoalEvent_0002.ogg` | `Uncategorized/SFX_GoalEvent/` |
| Goal | `goal-events/SFX_GoalEvent_0005.ogg` | `Uncategorized/SFX_GoalEvent/` |
| UI | `ui/SFX_UI_Countdown_0001.ogg` | `UserInterface/SFX_UI_Countdown/` |
| UI | `ui/SFX_UI_Countdown_0002.ogg` | `UserInterface/SFX_UI_Countdown/` |
| UI | `ui/SFX_UI_InGame_0006.ogg` | `UserInterface/SFX_UI_InGame/` |
| UI | `ui/SFX_UI_InGame_0016.ogg` | `UserInterface/SFX_UI_InGame/` |
| UI | `ui/SFX_UI_MainMenu_0001.ogg` | `UserInterface/SFX_UI_MainMenu/` |
| UI | `ui/SFX_UI_MainMenu_0002.ogg` | `UserInterface/SFX_UI_MainMenu/` |
| UI | `ui/SFX_UI_MainMenu_0003.ogg` | `UserInterface/SFX_UI_MainMenu/` |
| UI | `ui/SFX_UI_MainMenu_0004.ogg` | `UserInterface/SFX_UI_MainMenu/` |
| UI | `ui/SFX_UI_MainMenu_0006.ogg` | `UserInterface/SFX_UI_MainMenu/` |
| UI | `ui/SFX_UI_Boost_0001.ogg` | `UserInterface/SFX_UI_Boost/` |
| UI | `ui/SFX_UI_Boost_0002.ogg` | `UserInterface/SFX_UI_Boost/` |

Ball hits use three spectrally screened `SFX_Impacts` thuds chosen for a weak low
profile (single short event, <300 Hz dominance, no ring), tier-matched by contact
speed. The steady engine/boost/vehicle loops were chosen by spectral profile:
flat, gap-free envelopes. One-shot-like files (e.g. `SFX_Motor_OctaneMK2_0002`,
all `SFX_REV_*`), the tonal drones `SFX_Ball_0002/0003` and `SFX_AMB_3D_0001`
(the latter read as a constant horn when looped) were excluded deliberately.

Volumes are mixed client side by `web/audio.js` and configured in the Audio dialog
(`web/audio-settings.js`). Files are streamed as OGG Vorbis; browsers that cannot decode
OGG (notably Safari) silently fall back to a silent electronic-substitute mixer.
