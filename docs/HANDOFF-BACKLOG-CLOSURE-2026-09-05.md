# Owner follow-up closure — 2026-09-05

This closes the current owner-reported fixes, not the historical future-feature wishlist.

- New game: larger Found the City action; Back on the same row at the far right. Verified at 1280px and 390px, including returning to the menu.
- Large Park wishes: previously delivered in 1d79257; recreation checks the whole park footprint near the citizen's home.
- Rail bridges: raised water spans, §60/tile and §16/tile/year. Both travel and freight use the connection. Stations and road crossings remain on land. Demolition, undo, saves, routes and beaver-pond protection are covered by 20 regression checks; the actual game scene and generated rail sheet were inspected.
- Flock cameras: the owner correctly identified a missed GitHub branch. Merged origin/cameras at bf659ec, preserving its history and the newer civic footprints, sentencing, construction ages, camping, Large Park capacity and rail rules. Camera is the eighteenth remote tool, shortcut E; place along plain roads. Coverage helps police investigate, increases wrongful arrests, and affects watched residents' mood and city capacity. The original proposal remains historical design context.

Integration fixes: corrected the camera flood-fill visitation generation; camera tiles reject later wall/rail construction; invalid camera locations emit no coverage; road/wall edits refresh coverage immediately; joined-building burglary victims resolve through the building anchor. Cold-case notices describe a wrongful conviction without claiming a sentence is still being served.

Validation: full suite 793 checks, zero failures. Includes seven new camera integration checks against an independent road-coverage reference, placement order, live wall edits/undo, invalid sources, joined-building victims and saved victim exemption. Existing camera tests now provide actual prison/pacification capacity under the current sentencing rules. The hostile reviewer independently reran 27 integration checks and requested an additional correction to the probe's lifetime clearance accounting.

Browser: actual remote selection and road placement produced one camera, 77 covered tiles, a §100 purchase and §2,000 annual network charge. Undo returned zero cameras/coverage and refunded §100. The Camera button remained accessible in the 390px remote. Current civic and speech-bubble contact sheets were regenerated.

The owner control-city export is still absent; no owner-city regression is claimed. Historical camera balance tables are not current measurements; camprobe now supplies 3×3 justice facilities and records prison and camping context.

Final hostile review: 9.0/10, no blocking gameplay findings. Six additional probe regressions pass: lifetime totals beyond 200 retained arrests, repeated cases, overlapping files, wrongful convictions and automatic case closures. The corrected probe observes each monthly legitimate closure and consumes each matching conviction once; it does not infer lifetime results from the truncated final arrest log. Run these with node tools/check-camprobe-clearance.mjs.

Current probe: seeds 7 and 3, eight warm-up years plus ten measured years, one police station and three prisons, 0 versus 10 cameras. Clearance rose from 20.59% to 61.76% and 24.49% to 73.33%; wrongful convictions rose from 1 to 3 and 1 to 7. Approval fell from 52.07 to 49.08 and 54.37 to 48.44. These are two controlled runs, not universal balance guarantees. Command: node tools/camprobe.mjs --seeds 7,3 --years 10 --warm 8 --cams 0,10 --csv.
