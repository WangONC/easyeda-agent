# Host Pad identity regression

`host-pad-identity.json` is an unmodified typed `board.snapshot_compact` response
from FASTPATH_SMOKE_01, PCB 29f9e2cced590eba, EasyEDA 3.2.186 / Connector 1.4.4,
captured 2026-09-09 (Asia/Shanghai). No debug script or PCB mutation was used.
It has 16 real instance-qualified pads with geometry, plus six false local-ID
missing-pad sentinels (e12–e15, e7–e8). Their MULTI layer is assigned by the
missing-pad fallback, not read from a native pad.

The Connector regression reproduces repeated footprint-local declarations and
bulk instance IDs, using the captured geometry projections. Mock RECT shapes
reproduce the boxes only; raw shape, hole and plating getters were not exposed
by this capture. Do not use this fixture as evidence of physical pad shape or
plating. Official SDK EPCB_LayerId.MULTI = 12 describes the layer only.

Go tests first reproduce unsupported_obstacle from the original response, then
check the expected normalized projection independently verified by Connector
tests: real pads retained, component ownership populated, no phantom sentinels.
They verify multilayer/SMD crossing, safe bypass, numeric clearance, compact
serialization and unknown-geometry rejection. Production Go keeps fail-closed
unchanged; there is no obstacle-skipping workaround.
