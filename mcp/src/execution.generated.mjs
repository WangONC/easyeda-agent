// Generated from extension/src/execution.ts and the Go ActionSpec catalog. Do not edit.
const contracts = {
    "board.copy": {
        "version": "execution.v1.1",
        "hash": "c4719db2f124fe5e3f6845571001b92c96cd3947e624d3f3548c251534041bf4",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "board.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.create": {
        "version": "execution.v1.1",
        "hash": "cb553ea1b925b0fcf6da4d31ae8aced6dd13341f28885e78a0ae6fab334709f9",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "board.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicUuid optional",
            "pcbUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.current": {
        "version": "execution.v1.1",
        "hash": "c6c3cb2c11737c535ede9b96a8c23fdb78a8503694a9a0d7d9404b4b701e142d",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.delete": {
        "version": "execution.v1.1",
        "hash": "affbb07d67946154cf71a35bf57fd4b3598c8609f2bc3a9081b20939fb7d8189",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.list": {
        "version": "execution.v1.1",
        "hash": "844303821e93b1e80faec12ea06fe9c11ba50be104afd75ae72e7a9ade3c58c5",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.new_pcb": {
        "version": "execution.v1.1",
        "hash": "e9aa11abb1e1cc2a675cc937f563b35567d80d8d98258f79609ae395c85f5801",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "board.list",
                "pcb.docs"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicUuid optional (default = current board's schematic)",
            "name optional (rename the new board)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.rebind": {
        "version": "execution.v1.1",
        "hash": "214f3cc54e4f971e1f4f7eff9321338477d5f8346ad3e4de92dd6f4589264958",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "board.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicUuid",
            "pcbUuid optional",
            "name optional (default: current board)",
            "force optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.rename": {
        "version": "execution.v1.1",
        "hash": "d843a3516afe921ff7820ebde5d906e89e98f3230b185d739857d60501ebc51b",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "newName"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "board.snapshot_compact": {
        "version": "execution.v1.1",
        "hash": "e140602896dbbf9edb486ac09d5af2219f3fe839bbe2d61c9fd827841636bc42",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "document_uuid",
            "project_uuid",
            "nets[] optional",
            "bbox [minX,minY,maxX,maxY] optional (mil)",
            "layers[] optional",
            "include {components,pads,traces,vias,fills} optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "debug.exec_js": {
        "version": "execution.v1.1",
        "hash": "8633e3c3401926ba03037f21469afe55861eb5052400b7b1f8745f4a7f220238",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT",
            "PROJECT_TOPOLOGY",
            "LIBRARY_ASSET",
            "NAVIGATION_SELECTION",
            "NATIVE_RECOMPUTE",
            "SAVE",
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "code"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "document.current": {
        "version": "execution.v1.1",
        "hash": "f828b7757fc7289a07ae0238e9529e32b54781ab915eb717be00c2b6d69875b4",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "document.open": {
        "version": "execution.v1.1",
        "hash": "67a19e621d922e27503251722f107bd77b8500e3e62ef99b9b693e4f6731d28b",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.device.create": {
        "version": "execution.v1.1",
        "hash": "64ac70e9f9cd06efb82294009d7525b7294d15897468a845ae777dab6814ec41",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "library.device.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "symbol {uuid,libraryUuid}",
            "footprint optional {uuid,libraryUuid}",
            "model3D optional {uuid,libraryUuid}",
            "property optional",
            "scope/libraryUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.device.delete": {
        "version": "execution.v1.1",
        "hash": "767e40845723c86feff8a816899ba11cf93deabc506cf1438e3821b79c3af30f",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "expectedName"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.device.get": {
        "version": "execution.v1.1",
        "hash": "456d5b729b16d73d1707b42ee346778d7769945be857996b44c2bb4b684aa67a",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.device.set_model3d": {
        "version": "execution.v1.1",
        "hash": "8106c924c6dacef3c12c338dc2f7118992bf55e79ab7f7fbfbd6d854049a031c",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "expectedName",
            "model3D {uuid,libraryUuid} OR clear=true"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.footprint.build": {
        "version": "execution.v1.1",
        "hash": "e2fb058237d099f102ddee2e1990050450d9159adb63dc2fd0438461ea663117",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "pads[] {number,layer,x,y,rotation?,shape,hole?,metallization?,padType?}",
            "lines[] {layer,startX,startY,endX,endY,width}"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.footprint.copy": {
        "version": "execution.v1.1",
        "hash": "e2c256c70e0a664731773f64fae29bba9a575049efbe6c7afe93d2e3a811c61c",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "library.footprint.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "sourceLibraryUuid",
            "name",
            "scope/libraryUuid optional",
            "classification optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.footprint.create": {
        "version": "execution.v1.1",
        "hash": "3804fc3ced1c2aa3ac6b61bbb0582b92ed2d28be546c896d5a0bef92df1996a1",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "library.footprint.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "scope optional (personal|project)",
            "libraryUuid optional",
            "classification optional string[]",
            "description optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.footprint.delete": {
        "version": "execution.v1.1",
        "hash": "747f88ccbc7f30fe9eda756ecd1d90911b9b2e0244e76aa875c4189e634acf3a",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "expectedName"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.footprint.get": {
        "version": "execution.v1.1",
        "hash": "ba8ed6d2484ed755128582d74cdb031d8f7d932cba1cb8cadb694e1fa4188f2b",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.list": {
        "version": "execution.v1.1",
        "hash": "a24ee11f94c7d45515e23ca749aab8985253c731d853c4653f537dcb926e85b1",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.model3d.copy": {
        "version": "execution.v1.1",
        "hash": "e6beeb046f8e2f2fd4c4e65efab0276e116d4ee5814c1a9dc55341329f00449f",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "sourceLibraryUuid",
            "name",
            "scope/libraryUuid optional",
            "classification optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.model3d.create": {
        "version": "execution.v1.1",
        "hash": "8e6ac41a44379e66ee3adbeadab366a55e4076cd162d3490cffd8bee5a904543",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "library.model3d.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "dataBase64",
            "fileName optional",
            "mimeType optional",
            "unit optional (mm/cm/m/mil/inch)",
            "scope/libraryUuid optional",
            "classification optional",
            "description optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.model3d.delete": {
        "version": "execution.v1.1",
        "hash": "572c411dc9919ec370604dace8e1374628f8202773b002ab5a52e7a3209c2d13",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "expectedName"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.model3d.get": {
        "version": "execution.v1.1",
        "hash": "3fb260f8dec4458a6278d636bdc2ca51d257aae94c9bc86c661e493d8a1a3606",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.model3d.search": {
        "version": "execution.v1.1",
        "hash": "f6879e4fbad0e01b4c05ee3fce658d473591bbb35ec180e76e5f707699295cec",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "query",
            "libraryUuid optional",
            "classification optional",
            "limit optional 1..100"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.symbol.build": {
        "version": "execution.v1.1",
        "hash": "3e66dba6632668463615f05728a1ecb7011838c34820dcb6b0fb955556bee1b5",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "outline[] x/y coordinates",
            "pins[] {number,name,x,y,rotation?,length?,shape?,pinType?}",
            "circles[] optional {centerX,centerY,radius,lineWidth?}"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.symbol.create": {
        "version": "execution.v1.1",
        "hash": "3fbb8b1230af34ac441d3bf5c1599bec0040536aa1cb7008ee409cb15739f400",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "library.symbol.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "scope optional",
            "libraryUuid optional",
            "classification optional string[]",
            "symbolType optional",
            "description optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.symbol.delete": {
        "version": "execution.v1.1",
        "hash": "6b25a01c213d4db2f3bb9996e75fc21b403a846a583796d64278f213701942c1",
        "executor": "CONNECTOR",
        "effects": [
            "LIBRARY_ASSET"
        ],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid",
            "expectedName"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "library.symbol.get": {
        "version": "execution.v1.1",
        "hash": "5efe45967e54f93a93c30b3939baff5217535d44baf284fdf6f390ff4a31ebbf",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "LIBRARY",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "uuid",
            "libraryUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.add_component": {
        "version": "execution.v1.1",
        "hash": "dca260c636c2c4ca9c24bc024b60c7f39182ca4706bede89765f25a80d5706bd",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list",
                "pcb.nets.list",
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "libraryUuid",
            "uuid",
            "x",
            "y",
            "layer optional (default 1=TOP)",
            "rotation optional",
            "designator optional",
            "uniqueId optional",
            "nets optional (object padNumber→net)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.align": {
        "version": "execution.v1.1",
        "hash": "2586bdf44da06ca39940d2025f0c8217402aad36a0d4c20dc322246ed35040af",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "mode",
            "primitiveIds optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.beautify": {
        "version": "execution.v1.1",
        "hash": "2ca5d34b6db034a63ccc43845bf3b7e59a788e1ac01998f83639994c5f7b8105",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "preview",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.line.list",
                "pcb.drc.check",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "scope (all|selected, default all)",
            "net optional (single) OR nets optional ([]string — beautify only these nets)",
            "layer optional",
            "cornerRadiusRatio optional (default 3)",
            "forceArc optional (default false)",
            "mergeTransitionSegments optional (default false)",
            "protect optional (diff/equal-length, default true)",
            "drc optional (default true)",
            "drcRetryCount optional (default 4)",
            "rebuildPour optional (default true)",
            "dryRun optional (default false)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.board.info": {
        "version": "execution.v1.1",
        "hash": "b9572bc9a920a4f3f44160e6f0f7d4616d8dcd64a25aaccbda03c23b96832d31",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.clear_routing": {
        "version": "execution.v1.1",
        "hash": "24328d0d550df3f2e636c75e67592434dc88e96398a704b5d456e48787056274",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "type optional (all|net|connection, default all)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.component.attrs_backfill": {
        "version": "execution.v1.1",
        "hash": "4818cf8cd2cee211f8dd94ec4dffda8f1a39c631d8e1d59121e95ca8768707ff",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "overwrite optional (default false)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.component.delete": {
        "version": "execution.v1.1",
        "hash": "da8d1ea5049bc11fc42555d26a54239c9ead9bf9743dde326702bf2833375206",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.component.lock": {
        "version": "execution.v1.1",
        "hash": "937247074ccaa0638f1806d7dfe667c82269192b9ff4a602ae0f4155aa1d3200",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string or string[])",
            "locked optional (default true)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.component.modify": {
        "version": "execution.v1.1",
        "hash": "a1e3146ea6b1625d0a7a1cd45dd2616623ff6f63888b027c6dcf48d086e94509",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveId",
            "patch"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.components.arrange": {
        "version": "execution.v1.1",
        "hash": "c40b1966d4c85a38f5e6a7e0b4509081b77a9755ea7f00dca868026aa8c9a193",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "mode optional (cluster|grid, default cluster)",
            "primitiveIds optional",
            "pitch optional",
            "gutter optional",
            "cols optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.components.list": {
        "version": "execution.v1.1",
        "hash": "b80f790cb2788965ea0960d46220b54c54167acfb16bff0aa29fe2f94914ba0b",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "layer optional",
            "includeBBox optional",
            "includePads optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.components.move": {
        "version": "execution.v1.1",
        "hash": "3fbe3aed4bc972c98cc2d73f5d9524fe831b7c68dd494762be672780ed68cf74",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "dx",
            "dy",
            "primitiveIds optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.constraint.list": {
        "version": "execution.v1.1",
        "hash": "d2a012c291d5f81430302799669eb405a46b24ebef2bb24f78a882bb854e85c4",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.differential_pair.create": {
        "version": "execution.v1.1",
        "hash": "a0ba15604a8571045ff2faf271a0386cc94f07bb7268324e8671e92960c33de8",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.constraint.list",
                "pcb.report"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "positiveNet",
            "negativeNet"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.differential_pair.delete": {
        "version": "execution.v1.1",
        "hash": "40214c338fbd7599ca3c29e6809fc45f9107c80c063aea73fc45b86ed90fd5ad",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.constraint.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.differential_pair.rename": {
        "version": "execution.v1.1",
        "hash": "a881235d4a048c5f1742cfc90a576113ee1fe78ff343bc5935be8d62b7a23f77",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.constraint.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "newName"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.distribute": {
        "version": "execution.v1.1",
        "hash": "0b179f021768ceec45c6debb3e07f554b7240f178983076a55a1a22afcd2752d",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "axis",
            "primitiveIds optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.documents.list": {
        "version": "execution.v1.1",
        "hash": "8053f3c3e6870a11157ec0e3ecc91e61b4e9b48d1e41fc7947a4190f6f367564",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.drc.check": {
        "version": "execution.v1.1",
        "hash": "4c7f1e5824797b6342c4d831f8e8c05cbb7427088b46d1448ce9eca0fcb17be0",
        "executor": "CONNECTOR",
        "effects": [
            "NATIVE_RECOMPUTE"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "strict optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.drc.compare": {
        "version": "execution.v1.1",
        "hash": "d5b1d80c1e3416a5c470fd7b1d551129b21e2fb2149a63fcb2d41576fcb6650a",
        "executor": "CLI_COMPOSITE",
        "effects": [
            "NATIVE_RECOMPUTE",
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [
            "board.snapshot_compact",
            "pcb.drc.check"
        ],
        "supported_parameters": [
            "project_uuid",
            "document_uuid",
            "run_native:true",
            "baseline_id optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.drc.rules": {
        "version": "execution.v1.1",
        "hash": "71eb6e065950aa3a20a2cf22b38eec3ac5a03bbf63b8b4748411c4644bf629b4",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.equal_length_group.add_nets": {
        "version": "execution.v1.1",
        "hash": "3fd8cf314acdc71e2f41d220c6e64fa6dda7af74aab6fe34a419234ed68ffd45",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.constraint.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "nets[]"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.equal_length_group.create": {
        "version": "execution.v1.1",
        "hash": "0108de82c95e61defc84be4cf3dda6ac18b14696bb82f7b7f3f9a9a5d8a28299",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.constraint.list",
                "pcb.report"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "nets[]"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.equal_length_group.delete": {
        "version": "execution.v1.1",
        "hash": "3c1d7d202d6f5a534c8cd236bb9cb3152e753c0864e3390e50b03ade4e7c785f",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.constraint.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.export.dsn": {
        "version": "execution.v1.1",
        "hash": "8c01b6639ffbf8f6a08a78d5d781e61098d4ff2c452c8820065b2b76cc2f2df6",
        "executor": "CONNECTOR",
        "effects": [
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "fileName optional",
            "injectKeepout optional (default true)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.fill.create": {
        "version": "execution.v1.1",
        "hash": "4f96dfd45ddedf8e4e583b7ab3ed658ceb883f707cafdfcae6babefe51274fb1",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.fill.list",
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "points ([[x,y],...] mil)",
            "net optional",
            "layer optional (default 1=TOP)",
            "fillMode optional (solid|mesh|inner)",
            "lineWidth optional",
            "locked optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.fill.delete": {
        "version": "execution.v1.1",
        "hash": "aa75b9e41d6f7e0393c1d7fa5db066395abde4c364238189e2ab810ebcb4cdf0",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.fill.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string or string[])"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.fill.list": {
        "version": "execution.v1.1",
        "hash": "0791b8878e66392948e8bc3f4c8f486b8a2b4fe90be72978d4f4f54cc7295cbf",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "layer optional",
            "net optional",
            "includeBBox optional (default false)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.grid_snap": {
        "version": "execution.v1.1",
        "hash": "72f67257b11bf905ac45bcdad6919191ae6387cafa9026c312d25700883d9c04",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "grid",
            "primitiveIds optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.import_autoroute": {
        "version": "execution.v1.1",
        "hash": "a9e07fceb287241953ae184b72199f882bbcda6dd0b2cc3675a9e1ad43951b3a",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "fileBase64",
            "format optional (ses|json, default ses)",
            "fileName optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.import_changes": {
        "version": "execution.v1.1",
        "hash": "b1eb65752fea287254846f7e28af4c32fdb582d4f9214f0535c50c33feaa3fee",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list",
                "pcb.nets.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicUuid optional",
            "ensureBoard optional (default true)",
            "recomputeRatline optional (default true)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.layers.list": {
        "version": "execution.v1.1",
        "hash": "39c1c1cb2a66b880624e9df87b49dc1d7333afd05d4fb9c9fd387276c1a1f589",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.layers.set_current": {
        "version": "execution.v1.1",
        "hash": "3e16e15f52905e320a371635420cb9855079e75cc1c9686183bef8a18ef2d726",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.layers.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "layer (id|name|top|bottom|inner1)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.layers.visibility": {
        "version": "execution.v1.1",
        "hash": "d7ded45291743aa53ef0450cd0e1c31153f9717e22e65b2986de7a7330cf44e4",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.layers.list",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "preset optional (top-only|bottom-only|copper-only|silk-only)",
            "show optional ([]layer specs)",
            "hide optional ([]layer specs)",
            "exclusive optional (bool, hide others when showing)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.line.create": {
        "version": "execution.v1.1",
        "hash": "6f67d1d7226827f884d0a8cb2af844daee70287b5378729651a8a3a64f53665a",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "startX",
            "startY",
            "endX",
            "endY",
            "layer optional (default 1=TOP)",
            "lineWidth optional (default 6)",
            "net optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.line.list": {
        "version": "execution.v1.1",
        "hash": "9dc494074f446465c93ed0fa5332611e6b4a8a6ee06b329957fa6cb0a28b00b6",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net optional",
            "layer optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.manufacturing.export": {
        "version": "execution.v1.1",
        "hash": "eb71e7a31843a1490fd46f06b9f1d5b1a76db874e085cde6e9d511347f50e52a",
        "executor": "CONNECTOR",
        "effects": [
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "project_uuid",
            "document_uuid",
            "profile:{id,reviewed:true,units:mm,layers:[IDs]}",
            "verification_ids optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.nets.list": {
        "version": "execution.v1.1",
        "hash": "60850af030615d8cffd5c8d6ce13076f95628328f8cbad5434932c68de3ee040",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.outline.clear": {
        "version": "execution.v1.1",
        "hash": "7e939362d792f39370477273c5549e0b740cf3d43bfb2df689a0d4f53393bec6",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.outline.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.outline.get": {
        "version": "execution.v1.1",
        "hash": "c3ce31ff63ed87f4ec0b804674fbc78d80f6f0809c3b41522b21f9d7b3e7ea4d",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.outline.set": {
        "version": "execution.v1.1",
        "hash": "6e4950567b1aa460706cab2bfba5e293a336b819a3a5a57a51d68ea1ad9a2659",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.outline.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "points ([[x,y],...] mil)",
            "replace optional (default true)",
            "lineWidth optional (default 10)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.page.clear": {
        "version": "execution.v1.1",
        "hash": "fbad2809614c54593cc6e4a4f2d731fbee204d33816b581ba562b0c6c63a810c",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "preview",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.components.list",
                "pcb.report"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "only optional (subset of components,routing,copper,regions,silk — omit = all)",
            "preserveOutline optional (default true)",
            "includeLocked optional (default false)",
            "dryRun optional (default false)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.plane.refresh": {
        "version": "execution.v1.1",
        "hash": "4c2931a6ce2c58f43eb14fac1c0ff06ac4241c553a4f1d6deac218b3f3b320b4",
        "executor": "CLI_COMPOSITE",
        "effects": [
            "NATIVE_RECOMPUTE"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "board.snapshot_compact"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [
            "board.snapshot_compact",
            "pcb.pour.list",
            "pcb.pour.rebuild"
        ],
        "supported_parameters": [
            "project_uuid",
            "document_uuid",
            "base_revision",
            "logical_ids"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.pour.create": {
        "version": "execution.v1.1",
        "hash": "909554800e1d6e312b87ee57b71f3335bdbbd3de6ebf499ac224c98b35ae3905",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.pour.list",
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "points ([[x,y],...] mil)",
            "net optional (default '')",
            "layer optional (default 1=TOP)",
            "fill optional (solid|grid|grid45)",
            "name optional",
            "priority optional",
            "lineWidth optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.pour.delete": {
        "version": "execution.v1.1",
        "hash": "7bf32cb8db3a86c73f3cacec24abf7bd55eacf14bca4bc610c43b2722b0711ba",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.pour.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string or string[])"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.pour.list": {
        "version": "execution.v1.1",
        "hash": "0b74efa595041f2e017c7e6d6e46775d0007af9ca87e424daf2a734cfd253b5f",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net optional",
            "include_geometry optional boolean (bounded native filled-copper evidence; freshness unverified)",
            "geometry_limit optional 1..64, default 16"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.pour.rebuild": {
        "version": "execution.v1.1",
        "hash": "73ed363753c6743a8ed6fa75ccd0799d98d7478e3e74a2951b33cf2c8434411f",
        "executor": "CONNECTOR",
        "effects": [
            "NATIVE_RECOMPUTE"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net optional (legacy)",
            "logical_ids optional 1..64 handles (explicit refresh)",
            "project_uuid and document_uuid required with logical_ids"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.region.create": {
        "version": "execution.v1.1",
        "hash": "4c28a6376a78f0d8e68cddbb78aab0681f3857bde734cba4f3f6a6b802485f61",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.region.list",
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "points ([[x,y],...] mil)",
            "layer optional (default 1=TOP)",
            "ruleType optional (name|number or list; default keep-out)",
            "name optional",
            "lineWidth optional",
            "locked optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.region.delete": {
        "version": "execution.v1.1",
        "hash": "222fd98fbd254ca8526b41e9f7e4062dfb817937320fd8176c8983db52e05028",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.region.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string or string[])"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.region.list": {
        "version": "execution.v1.1",
        "hash": "bea2ce225cebee3a5aff226f3d1b20e47c9fc736ec91bc6da09086cb8e2363d4",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "layer optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.report": {
        "version": "execution.v1.1",
        "hash": "931b5322de8680a7a41d56a1b2968473d51cc0c0b35c2b98f5f9356f90b1309e",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "telemetry optional boolean: compact local geometry statistics; board or nets scope only, requires project/document identity",
            "nets optional name array",
            "pairs optional name array",
            "groups optional name array",
            "geometry optional boolean",
            "project_uuid/document_uuid required for geometry",
            "paths optional [{net,ids,start,end}]",
            "profile_id optional",
            "reference_net optional",
            "tolerance_mil optional (geometry report)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.route.delete": {
        "version": "execution.v1.1",
        "hash": "846fded8c2c1cd5b4fc15cba8182046f0c89d1deee715919f901b01becd9d3e0",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.line.list",
                "pcb.via.list",
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string or string[])",
            "kind optional (via|track — refuse ids of another kind)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.route.rip_up": {
        "version": "execution.v1.1",
        "hash": "f84ce754e79f59bc54748b039c250c733ad2d6f3f1bca19e00f96a46c8f1cb95",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.line.list",
                "pcb.via.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net optional (string or string[]); omit = all"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.route.via_hop": {
        "version": "execution.v1.1",
        "hash": "36f0dd681b0656afea5be6ccd1efe5b2ff8beb6ff869700318e2947f05b95920",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.drc.check",
                "pcb.via.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net",
            "fromX",
            "fromY",
            "toX",
            "toY",
            "layer optional (default 1=TOP)",
            "hopLayer optional (default 2=BOTTOM)",
            "lineWidth optional (default 6)",
            "holeDiameter optional (default 12)",
            "viaDiameter optional (default 24)",
            "stub optional (default 20 mil)",
            "bondFill optional (default false)",
            "bondSize optional (default 20 mil)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.routing_profile": {
        "version": "execution.v1.1",
        "hash": "bcd96319e949c0763682021f31e50048f0b45d1b628ffd48e8e30cac3fbc6302",
        "executor": "DAEMON",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [
            "board.snapshot_compact"
        ],
        "supported_parameters": [
            "project_uuid",
            "document_uuid",
            "operation:context|put|get",
            "profile_id for get",
            "profile for put"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.save": {
        "version": "execution.v1.1",
        "hash": "e25dbe01b0c05cfc58ab9993356f52f29649c9b42ed9ef02896efc8229575d6b",
        "executor": "CONNECTOR",
        "effects": [
            "SAVE"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": true
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.add": {
        "version": "execution.v1.1",
        "hash": "f19047983d34f0244c835df614256722639934bd868f4373eaede933d958b873",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.silk.list",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "text (required)",
            "x (mil, required)",
            "y (mil, required)",
            "layer optional (3|4, default 3)",
            "fontSize optional (mil, default 40)",
            "lineWidth optional (mil, default 6)",
            "rotation optional (deg, default 0)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.align": {
        "version": "execution.v1.1",
        "hash": "81a5f5169a7479621f67b0b4a71e0f73df357675e3d3a4f425ac83f0e4ecfef4",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.silk.list",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "offset optional (base mil gap, default 15, ×spacing)",
            "spacing optional (coefficient, default 1.5 — scales label drift for assembly/solder room)",
            "side optional (top|bottom|left|right — soft bias)",
            "refs optional ([designators]; others frozen)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.import_svg": {
        "version": "execution.v1.1",
        "hash": "622448c61fda9a26b670673dc2dcc00366313e09ec96442d9de65a6bbd4cd6e5",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.silk.list",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "polygons (required: complex polygon = array of TPCB_PolygonSourceArray, each [x0,y0,\"L\",x1,y1,…] in mil)",
            "x (mil, required — artwork top-left)",
            "y (mil, required)",
            "layer optional (3|4, default 3)",
            "width optional (mil — image width hint)",
            "height optional (mil — image height hint)",
            "rotation optional (deg, default 0)",
            "mirror optional (bool, default false — horizontal mirror; auto-true convention for bottom silk handled CLI-side)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.label_pads": {
        "version": "execution.v1.1",
        "hash": "4bce7feb1037708a7e808d0b6fe8e34afb82cd8551ebe45aaa3bae13a88d60f6",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "refs (required: []string — component designators to label, e.g. [J2, U1])",
            "content optional (pin-number|net-name|both, default both)",
            "layer optional (3=TOP_SILKSCREEN default, 4=BOTTOM_SILKSCREEN)",
            "fontSize optional (mil, default 30)",
            "lineWidth optional (mil, default 4)",
            "side optional (right|below|above|left|auto, default auto)",
            "align_axis optional (x|y|auto, default auto) — x: vertical pin array, y: horizontal pin array",
            "exclude_nets optional ([]string — skip these net names, e.g. [GND])"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.list": {
        "version": "execution.v1.1",
        "hash": "bd8d4b9b24ad1d6fee39ea90adc6fef23ba597b4a6996326bdeb11b9bdb67900",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.netnames": {
        "version": "execution.v1.1",
        "hash": "63b2b189650ae8ef11da5737edb871cbf4e83f7a8f3f1e3b5b46e358bf88d95a",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.silk.list",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "zone_rect (required: {left, top, right, bottom} in mil)",
            "layer optional (3=TOP_SILKSCREEN default, 4=BOTTOM_SILKSCREEN)",
            "align optional (left|right, default left — left=left-to-right order, right=right-to-left)",
            "fontSize optional (mil, default 40)",
            "lineWidth optional (mil, default 6)",
            "exclude_nets optional ([]string — skip these net names, e.g. [GND, +5V])"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.silk.set": {
        "version": "execution.v1.1",
        "hash": "f2aa3c0783168d996a3fd2fed43619ddc3c5d493ed92c37b41dd2bdfa747ecc9",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.silk.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string or [] , required)",
            "x optional (mil)",
            "y optional (mil)",
            "rotation optional (deg)",
            "fontSize optional (mil)",
            "lineWidth optional (mil)",
            "text optional",
            "align optional (center|mid|centerx|centery|left|right|top|bottom)",
            "ref optional (designator|board|outline|fill, default board)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.snapshot": {
        "version": "execution.v1.1",
        "hash": "d124870efa62fed6cc4890d3ad44debbea34cb7b7e24337cd36c07e9a8bb265d",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "fit optional (default true)",
            "tabId optional",
            "previousSha256 optional (enables stale-frame detection + auto-retry)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.stackup.set": {
        "version": "execution.v1.1",
        "hash": "516d159e1c6d97dc252ce55d84efe4e04b745d1c50258bcd3d55f32cf9f0da09",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.layers.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "count optional (2|4|6|…)",
            "layers optional ([{id, type: signal|plane, name?}])"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.track.lock": {
        "version": "execution.v1.1",
        "hash": "3be9faceb419b4f4eef499b5aa17833640035a5f0053b4d15ad866cf187f13a5",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.line.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net optional (string or string[])",
            "primitiveIds optional (string[])",
            "locked optional (default true)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.via.create": {
        "version": "execution.v1.1",
        "hash": "75167b88676190540b01bed7d97a315444264cd19511c0518ebbd2b7ec05d5f9",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "x",
            "y",
            "holeDiameter optional",
            "diameter optional",
            "net optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.via.list": {
        "version": "execution.v1.1",
        "hash": "c5074d29d5b3a57a08c50c2d630abfa59de22cfcf5a765c2c5a0a952857692f7",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "net optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "pcb.view.side": {
        "version": "execution.v1.1",
        "hash": "a3e4fdf049998cdfb9ea11b111022f97a47afc44710d85db6de2188f4ab71baa",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "pcb.layers.list",
                "pcb.snapshot"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "side (top|bottom)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "project.create": {
        "version": "execution.v1.1",
        "hash": "c733834edf18d7c83376a743ace59366f0e479721a2f23f48ea4e23687b271a4",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "project.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "name",
            "expected_project_uuid + session_token optional paired guards (Go acquires when omitted)",
            "client_transaction_id optional (Go generates when acquiring guards)",
            "team_uuid optional",
            "folder_uuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "project.current": {
        "version": "execution.v1.1",
        "hash": "b5a2ba6149765687911c0b60d88c279c20c5cbedb715f8a055757b3448f18638",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "project.list": {
        "version": "execution.v1.1",
        "hash": "51d073f496af98350cf424c3939be7853308515c6b2ca5152397ca0d81582ad8",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "team_uuid optional",
            "folder_uuid optional",
            "workspace_uuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "project.open": {
        "version": "execution.v1.1",
        "hash": "2403051d21e8fef06f5dc6378453c064f26446ebbc0167ae8ad20a2835348d15",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "project.current"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "project_uuid",
            "expected_project_uuid",
            "saved_current_project:true"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "route.apply_batch": {
        "operations": [
            "add_trace",
            "add_arc",
            "add_via",
            "delete_trace",
            "delete_via"
        ],
        "version": "execution.v1.1",
        "hash": "49b2ccf3cd0d88f88336d8d7e085bddedd67eea4e6aa853d9e19cd5389fd81da",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "board.snapshot_compact"
            ],
            "required": [
                "net",
                "layer",
                "geometry",
                "width",
                "hole",
                "diameter",
                "deleted_absence",
                "all_operations",
                "no_pending_native_write"
            ],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "existing_fast_owned_compensation; deletions not restorable",
        "dependencies": [],
        "supported_parameters": [
            "document_uuid",
            "project_uuid",
            "base_revision",
            "plan_hash",
            "client_transaction_id",
            "operations[{type:add_trace|add_via|delete_trace|delete_via, exact geometry or id}]"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "route.pair_plan": {
        "version": "execution.v1.1",
        "hash": "bc890f7fe2ff6007893778a3fe1ed25ef0caae5a6d7b28729f6aaa572ede1c24",
        "executor": "DAEMON",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [
            "board.snapshot_compact"
        ],
        "supported_parameters": [
            "project_uuid",
            "document_uuid",
            "base_revision",
            "positive_net",
            "negative_net",
            "layer",
            "width mil",
            "gap mil",
            "centerline [[x,y],...] mil",
            "transitions optional [{end:start|end,to_layer,diameter,hole,separation}]",
            "profile_id optional (verified differential width/gap)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "route.preflight": {
        "version": "execution.v1.1",
        "hash": "34a6a7de635e19b43cc0023132ee0735fa8dba61c42bdc54ce673887d70cdbce",
        "executor": "DAEMON",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [
            "board.snapshot_compact"
        ],
        "supported_parameters": [
            "document_uuid",
            "project_uuid",
            "base_revision",
            "routes[{net,layer,width,points:[[x,y],...]}]",
            "vias[{net,x,y,diameter,hole,from_layer,to_layer}]",
            "delete_ids[] optional",
            "protected_nets[] optional",
            "clearance_profile {clearance,min_width,min_hole,min_diameter,min_annulus} in mil"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "route.tuning_plan": {
        "version": "execution.v1.1",
        "hash": "7d208b4c543b74b18e4b1b0c28fa1bb835b2a8b5bd8dc507e6a2bd617dc55d83",
        "executor": "DAEMON",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [
            "board.snapshot_compact"
        ],
        "supported_parameters": [
            "project_uuid",
            "document_uuid",
            "base_revision",
            "net",
            "span_id",
            "corridor [minX,minY,maxX,maxY] mil",
            "target_mode: specified_length|follow_rule",
            "target_length mil (specified_length)",
            "corner: line_45|line_90|arc_90",
            "side: single|bilateral",
            "spacing_w mil (centerline spacing)",
            "min_amplitude_h mil",
            "profile_id optional (verified single-ended)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.bridgeCheck": {
        "version": "execution.v1.1",
        "hash": "c0908f9368d4cd651c5965295bd25f198dc7c00d9c7f5c2d85bd5e1e2ef80dea",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "allPages optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.check": {
        "version": "execution.v1.1",
        "hash": "b15a8e20761ad87e5e8fafe62ef1f99eaa96435170594b5b2ad2e62a6152370f",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "allPages optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.component.delete": {
        "version": "execution.v1.1",
        "hash": "46c2bb7877c64b4bd0a437c54b5a566fd6fc2b6da20bfe78412ac839ec80655f",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.component.modify": {
        "version": "execution.v1.1",
        "hash": "993ce893b69aea8a2007c2422bba09af255996256687dc15f475edd89874241c",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveId",
            "patch"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.component.place": {
        "version": "execution.v1.1",
        "hash": "047e1e5cd12f28e71547025417ac5044b05aa203e9b2bbd66aa28de5e5fcb51f",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "libraryUuid",
            "uuid (device-library uuid, not an instance id)",
            "x",
            "y",
            "rotation optional",
            "mirror optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.component.replace": {
        "version": "execution.v1.1",
        "hash": "6090bed3e8f2cc7aae06cf7102016a8915bf4cf32db6e9c1088f9b591f66e1ec",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list",
                "schematic.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveId",
            "lcsc OR deviceUuid (+deviceLibraryUuid) OR query",
            "keepProperties optional (default false)",
            "client_transaction_id optional (activation-scoped)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.component.resolve_lcsc": {
        "version": "execution.v1.1",
        "hash": "0f58b2468e008d20f777dd6cac3f8b1a34d80d6abb17df50efd10fe1d66e4a03",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveId optional (single part)",
            "apply optional (default false = dry-run report)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.components.list": {
        "version": "execution.v1.1",
        "hash": "aab000106ac273befb61b4f2360defbf17f7cf125108d4c76f7279ec7fcd63ae",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "allPages optional (WARNING: non-active pages return shallow data — pins/bbox may be empty even when wired; switch to the page via document.switch for accurate data)",
            "includePins optional (adds pinsAvailable and pinsError on failure)",
            "includeBBox optional",
            "includeDeviceIdentity optional (resolves instance ids to device-library uuids; unresolved parts report deviceIdentityError)",
            "includeConnectivitySummary optional (active page only, read-only)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.create": {
        "version": "execution.v1.1",
        "hash": "7dea59b02d3ebf3828b6635e75180fff018b162ed5ee22a1be3858853dfaaae8",
        "executor": "CONNECTOR",
        "effects": [
            "PROJECT_TOPOLOGY"
        ],
        "target_scope": "PROJECT",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [
                "schematic.pages.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "expected_project_uuid",
            "session_token from project.list",
            "client_transaction_id",
            "board_name optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.drc.check": {
        "version": "execution.v1.1",
        "hash": "b5d20f31d07b2c4e236f7d3492ace53f5502b726c81f9fcc435ed7a727e5f23e",
        "executor": "CONNECTOR",
        "effects": [
            "NATIVE_RECOMPUTE"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "strict",
            "includeVerboseError"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.export.bom": {
        "version": "execution.v1.1",
        "hash": "f19ddf514345e33f042cd6c57eb28865abccd0a39f2bcd7ccfbd2cbae497f3ed",
        "executor": "CONNECTOR",
        "effects": [
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "fileType",
            "template optional",
            "columns optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.export.image": {
        "version": "execution.v1.1",
        "hash": "b0289a5912cac3152fe9d1e721c76a9e846576f81d4fc880317c7ac54ca79ab2",
        "executor": "CONNECTOR",
        "effects": [
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "format svg|png|pdf (default svg)",
            "primitiveIds optional (auto-selects them)",
            "scope selection|page|project",
            "fileName optional",
            "theme optional",
            "lineWidth optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.export.netlist": {
        "version": "execution.v1.1",
        "hash": "bd8de862e78aa57c9c16f2414dacc3f672ae9addb122d187df300d7b82d9a02a",
        "executor": "CONNECTOR",
        "effects": [
            "ARTIFACT_DELIVERY"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "netlistType optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.group.move": {
        "version": "execution.v1.1",
        "hash": "53024b52336ab2288e2af9f22b3bfd06ab49848e481defd15abbc2585fdea90e",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds (string[], components and/or wires)",
            "dx",
            "dy"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.library.get_by_lcsc": {
        "version": "execution.v1.1",
        "hash": "c34217209148a06a4751ac166c8af6105e50f9fe864af66df23d4f6cbc6c8b48",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "lcscIds (string or string[] of C-numbers)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.library.search": {
        "version": "execution.v1.1",
        "hash": "6b3fca150505df67988509d37b5f39c5f0a70be5e24dd2aa0f5ce0446f22be76",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "query",
            "limit optional",
            "libraryUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.netflag.create": {
        "version": "execution.v1.1",
        "hash": "d098349cf9cefd9334249813399bc157b4dd518c9c2bb6e9a18b756c57f55062",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.export.image"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "kind",
            "net",
            "x",
            "y",
            "rotation optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.page.clear": {
        "version": "execution.v1.1",
        "hash": "087c9d9ff13968f6fcd0f84dbccc8df7234c9a53ad378733a240b58cb4633acb",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "preview",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "preserveSheet optional (default true)",
            "dryRun optional (default false)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.page.create": {
        "version": "execution.v1.1",
        "hash": "e783cfd8442c9e03072c842bea34403bb31f63f0cc20c45b5c1331b2c4067260",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.pages.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicUuid"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.page.delete": {
        "version": "execution.v1.1",
        "hash": "5182c0630ff703585dc4c498871cabeacbfceab432ea22ab654747d7b4af3b4d",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "pageUuid"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.page.open": {
        "version": "execution.v1.1",
        "hash": "92c3161b99ce31499cf77ef27a6b619f032a333746e693528cfbe0baebe7f982",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicPageUuid"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.page.rename": {
        "version": "execution.v1.1",
        "hash": "cd2179e197f676784854006451c8700aab24108a8a89b274c0048d03b62aeb58",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "pageUuid",
            "name"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.pages.list": {
        "version": "execution.v1.1",
        "hash": "0fbfe756d24fb7e9de080df02a8e5e6110a55b075dc857f520a6209c72c8a701",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.pin.disconnect": {
        "version": "execution.v1.1",
        "hash": "1204f65df734e3891649d59a66a8704995b7cca7bd542885b3dd40517af00737",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "designator + pin, OR flagPrimitiveId, OR wirePrimitiveId (at least one)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.pin.set_no_connect": {
        "version": "execution.v1.1",
        "hash": "77f854842be59917c8cef2c56a1ee8a1ad05ddc5d47e93a389dbd278e3492818",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list",
                "schematic.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "designator",
            "pins",
            "noConnected optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.power.connect_pin": {
        "version": "execution.v1.1",
        "hash": "3fb8f6e3cd5fe954f57ec58f615f856e14fcfde2e59d3d757f7949214306c094",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "pinX",
            "pinY",
            "kind",
            "net",
            "direction optional",
            "offset optional",
            "rotation optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.primitives.delete": {
        "version": "execution.v1.1",
        "hash": "471129186cf1ce16d1c3a1da4690c89b3ac3713368dd105d8f032883766d16fd",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds optional (string or string[]; default = current selection)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.read": {
        "version": "execution.v1.1",
        "hash": "016450fa6c62808a71d1c9244ca42a28fa86535ac7c0e07f8ef84742d9c6c7f5",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "allPages optional",
            "includeCheck optional (default true)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.rebind.footprint": {
        "version": "execution.v1.1",
        "hash": "1e48893a56c99012676a5ffd3f18fe847e4541e8570bf49da85760bc1ec72c9f",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list",
                "schematic.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveId",
            "footprint (name) OR footprintUuid (+footprintLibraryUuid)",
            "scope optional (default project)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.rebind.symbol": {
        "version": "execution.v1.1",
        "hash": "c66ef4ba99fcac2bb60290b53e3f0e12ec307f80424107b7e28860fb96a64e98",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.components.list",
                "schematic.drc.check"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveId",
            "symbol (name) OR symbolUuid (+symbolLibraryUuid)",
            "scope optional (default project)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.rename": {
        "version": "execution.v1.1",
        "hash": "1b33df5324b42fda199f0332bac49159d2fb7befdcba6bbc0a05956801c86ee1",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "schematicUuid",
            "name"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.save": {
        "version": "execution.v1.1",
        "hash": "c272a53d703936de1e7d245b57feeffcab540d8bdd51b82c3a79110514c4e2c2",
        "executor": "CONNECTOR",
        "effects": [
            "SAVE"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": true
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.select": {
        "version": "execution.v1.1",
        "hash": "62a579f79d25ddfd030881789d95a8b65f789259cb7f3bf1311f2de619bc5008",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "primitiveIds"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.text.list": {
        "version": "execution.v1.1",
        "hash": "2ef00b7beec78910db8d57918a45192b1073ddd5bfd702303fbfd75f1deda719",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.titleblock.get": {
        "version": "execution.v1.1",
        "hash": "61ad44e257b06c7bd93ebe2ca974ac37bb812e428e13a0ec6d9ee4713ebabe88",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "pageUuid optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.titleblock.modify": {
        "version": "execution.v1.1",
        "hash": "62a53c331a8119e910d41bc277f5fe65ff96febc057d2b01543dbff14ee9e3d1",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.titleblock.get"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "showTitleBlock optional",
            "titleBlockData optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "schematic.wire.create": {
        "version": "execution.v1.1",
        "hash": "b9537b96a648fc3433afd0ef595760a18d5f68461c1c050ad476181d67bda8ce",
        "executor": "CONNECTOR",
        "effects": [
            "DESIGN_CONTENT"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [
                "schematic.read"
            ],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "receipt_or_reconcile",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "points",
            "net optional",
            "style optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "system.health": {
        "version": "execution.v1.1",
        "hash": "61d15f1c74920f74f981f5c0bf14625256f46242dd18d1176ffc76f7a8a86993",
        "executor": "DAEMON",
        "effects": [],
        "target_scope": "HOME",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "system.notify": {
        "version": "execution.v1.1",
        "hash": "92e3ad1086d369c940da84d1d4f2bb3f1f2aef1703cb3ee1d5d3c08e326e75d7",
        "executor": "CONNECTOR",
        "effects": [],
        "target_scope": "HOME",
        "dry_run": "unsupported",
        "guard": [],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "read_only_retry",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "message (required)",
            "type optional (info|success|warn|error|question, default info)",
            "duration optional (seconds, default 3)"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "view.fit": {
        "version": "execution.v1.1",
        "hash": "8cda964ada6b109483bb7d8c4ae5da74ba0eb0eaf1825c081aa9243b505e41df",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "view.fit_selection": {
        "version": "execution.v1.1",
        "hash": "3aa9eeb4ce6ea2e471823f5b2bc88aed561c472faba58791c1f24023344b20f7",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "view.region": {
        "version": "execution.v1.1",
        "hash": "2a88430cc39948133e44dc01cb320bea80163969e1d959a0adc6813cdd3ba202",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "left",
            "right",
            "top",
            "bottom"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    },
    "view.zoom": {
        "version": "execution.v1.1",
        "hash": "f375262be1b039556190554a6d37593474a4b4b58e33330e7f299cbd0c8db8c4",
        "executor": "CONNECTOR",
        "effects": [
            "NAVIGATION_SELECTION"
        ],
        "target_scope": "DOCUMENT",
        "dry_run": "unsupported",
        "guard": [
            "project_uuid",
            "document_uuid",
            "document_type",
            "activation"
        ],
        "verification": {
            "verifier_refs": [],
            "required": [],
            "coverage": "COMPLETE",
            "quantization": "existing verifier only; no generic tolerance",
            "electrical_mapping": false,
            "persistence_required": false
        },
        "replay_policy": "bounded_navigation",
        "recovery": "reconcile_only",
        "dependencies": [],
        "supported_parameters": [
            "x optional",
            "y optional",
            "scale optional"
        ],
        "autonomous_eligibility": "EXCLUDED",
        "exclusion_reason": "Legacy execution has not completed target, recovery and Host qualification migration"
    }
};
export function contractFor(action) {
    return contracts[action];
}
export function validateContract(req, executor = 'CONNECTOR') {
    const c = contractFor(req.action);
    if (!c)
        return 'UNKNOWN_ACTION';
    if ((req.contractVersion && req.contractVersion !== c.version) || (req.contractHash && req.contractHash !== c.hash))
        return 'CONTRACT_MISMATCH';
    if (req.payload?.dryRun === true && c.dry_run !== 'preview')
        return 'INVALID_DRY_RUN';
    if (executor === 'CONNECTOR' && c.executor !== 'CONNECTOR')
        return 'EXECUTOR_UNAVAILABLE';
}
const nonempty = (x) => !!x && typeof x === 'object' && Object.keys(x).length > 0;
export function negativeResult(r) {
    return r.partial === true || r.verified === false || r.deleted === false || r.disconnected === false || nonempty(r.notApplied) || nonempty(r.survived) || nonempty(r.survivedIds) || (typeof r.survivedTotal === 'number' && r.survivedTotal > 0) || ['partial', 'uncertain', 'stale', 'failed', 'unverified'].includes(String(r.status));
}
export function interpret(req, resp, beforeDispatch = false) {
    const c = contractFor(req.action);
    const mutation = c?.effects.some(e => ['DESIGN_CONTENT', 'PROJECT_TOPOLOGY', 'LIBRARY_ASSET'].includes(e));
    let e = { operation_id: req.operationId || req.payload?.client_transaction_id, parent_operation_id: req.parentOperationId, request_id: req.id || '', contract_version: c?.version || '', contract_hash: c?.hash || '', expected_target: req.expectedTarget, verification: { state: 'UNAVAILABLE', coverage: 'PARTIAL', required: [], observed: [], missing: [], evidence_refs: [] }, recovery: { state: 'NOT_REQUESTED' }, persistence: { state: 'NOT_REQUESTED' }, request_satisfied: false, next_action: mutation ? 'reconcile_without_replay' : 'inspect', reason: 'legacy evidence does not prove semantic completion' };
    if (mutation)
        e.mutation_outcome = 'UNCERTAIN';
    if (beforeDispatch) {
        if (mutation)
            e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.reason = 'refused before dispatch';
        return e;
    }
    if (!resp)
        return e;
    if (req.payload?.dryRun === true && c?.dry_run === 'preview') {
        e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.request_satisfied = resp.ok === true && !negativeResult(resp.result || {});
        e.reason = 'declared no-write preview';
        return e;
    }
    const prior = resp.execution;
    if (prior) {
        const copy = structuredClone(prior);
        copy.persistence = { ...prior.persistence };
        copy.recovery = { ...prior.recovery };
        e = copy;
        const cvalid = prior.contract_version === c?.version && prior.contract_hash === c?.hash && prior.request_id === (resp.id || '') && (!req.id || req.id === resp.id);
        if (mutation && req.action !== 'route.apply_batch') {
            let valid = cvalid;
            const r = resp.result || {};
            switch (prior.mutation_outcome) {
                case 'NO_WRITE':
                    valid = valid && prior.write_attempted === false && r.mutation_started !== true && !nonempty(r.created_ids) && !nonempty(r.deleted_ids);
                    if (prior.request_satisfied)
                        valid = valid && completeEvidence(prior.verification);
                    break;
                case 'COMPLETE':
                    valid = valid && prior.native_settled === true && !!c?.verification.required.length && completeEvidence(prior.verification) && !negativeResult(r) && prior.recovery?.state !== 'RESTORED';
                    break;
                case 'PARTIAL':
                    valid = valid && prior.native_settled === true && prior.write_attempted === true && completeEvidence(prior.verification);
                    copy.request_satisfied = false;
                    break;
                case 'UNCERTAIN':
                    copy.request_satisfied = false;
                    break;
                default: valid = false;
            }
            if (!valid) {
                copy.mutation_outcome = 'UNCERTAIN';
                copy.request_satisfied = false;
                copy.reason = 'incomplete or conflicting execution evidence';
                copy.next_action = 'reconcile_without_replay';
            }
            return copy;
        }
    }
    if (prior) {
        const valid = prior.contract_version === c?.version && prior.contract_hash === c?.hash && prior.request_id === (resp.id || '') && (!req.id || req.id === resp.id);
        let blocked = !valid || ['INVALID', 'UNSUPPORTED'].includes(prior.verification?.state);
        if (req.action === 'route.apply_batch' && valid && prior.mutation_outcome === 'NO_WRITE' && prior.write_attempted === false && prior.reason === 'refused before dispatch' && !resp.result)
            return e;
        if (req.action === 'route.apply_batch' && ((prior.write_attempted === false || prior.mutation_outcome === 'NO_WRITE') && resp.result?.mutation_started === true))
            blocked = true;
        if (req.action === 'route.apply_batch' && prior.item_results != null && canonical(prior.item_results) !== canonical(resp.result?.item_results))
            blocked = true;
        if (req.action === 'route.apply_batch')
            blocked ||= prior.native_settled === false || prior.mutation_outcome === 'UNCERTAIN' || (['COMPLETE', 'PARTIAL'].includes(prior.mutation_outcome || '') && prior.native_settled !== true);
        else if (!mutation && !prior.request_satisfied)
            blocked ||= !(c?.effects.includes('ARTIFACT_DELIVERY') && prior.persistence?.state === 'PENDING_DELIVERY');
        if (blocked) {
            e.request_satisfied = false;
            if (mutation) {
                e.mutation_outcome = 'UNCERTAIN';
                e.next_action = 'reconcile_without_replay';
            }
            return e;
        }
    }
    e.observed_target_after ??= resp.context;
    const r = resp.result || {};
    if (mutation) {
        if (req.action === 'route.apply_batch') {
            e.mutation_outcome = 'UNCERTAIN';
            e.request_satisfied = false;
            e.item_results = r.item_results;
            if (typeof r.mutation_started === 'boolean')
                e.write_attempted = r.mutation_started;
            if (['stale', 'partial'].includes(String(r.status))) {
                if (r.mutation_started === false && fastNoWrite(r))
                    e.mutation_outcome = 'NO_WRITE';
                else if (r.status === 'partial' && fastSettled(r, req.payload || {}, false)) {
                    e.mutation_outcome = 'PARTIAL';
                    e.native_settled = true;
                }
            }
            if (r.status === 'complete' && fastComplete(r, req.payload || {})) {
                e.mutation_outcome = 'COMPLETE';
                e.native_settled = true;
                e.request_satisfied = true;
                e.verification.state = 'AVAILABLE';
                e.verification.coverage = 'COMPLETE';
                if (!e.verification.source)
                    e.verification.source = 'FastPath.matchesOperation';
                if (!e.verification.evidence_refs.length)
                    e.verification.evidence_refs = ['result'];
                e.next_action = 'continue';
                e.reason = 'Fast Path semantic readback';
            }
            if (r.rollback_complete === true && e.mutation_outcome === 'PARTIAL') {
                e.recovery.state = 'RESTORED';
                if (!('evidence_refs' in e.recovery))
                    e.recovery.evidence_refs = ['result'];
                e.request_satisfied = false;
            }
        }
    }
    else {
        e.request_satisfied = !!c && resp.ok === true && !negativeResult(r) && r.ok !== false && r.saved !== false;
        if (c?.effects.includes('SAVE')) {
            e.request_satisfied = e.request_satisfied && r.saved === true;
            e.persistence.state = e.request_satisfied ? 'SAVE_ACKNOWLEDGED' : 'UNKNOWN';
        }
        if (c?.effects.includes('ARTIFACT_DELIVERY')) {
            const invocationOK = e.request_satisfied;
            e.request_satisfied = e.request_satisfied && !!resp.artifacts?.length && resp.artifacts.every(a => typeof a.path === 'string' && !!a.path && typeof a.sha256 === 'string' && !!a.sha256);
            if (e.request_satisfied) {
                e.persistence.state = 'DELIVERED';
                e.reason = 'artifact delivery completed';
            }
            else if (invocationOK && resp.artifacts?.length && resp.artifacts.every(a => (!!a.path && !!a.sha256) || !!a.inlineBase64)) {
                e.persistence.state = 'PENDING_DELIVERY';
                e.reason = 'artifact delivery evidence pending';
            }
            else {
                e.persistence.state = 'DELIVERY_FAILED';
                e.reason = 'artifact delivery failed';
            }
        }
    }
    if (req.payload?.dryRun === true && c?.dry_run === 'preview') {
        e.mutation_outcome = 'NO_WRITE';
        e.write_attempted = false;
        e.request_satisfied = resp.ok === true && !negativeResult(r);
        e.reason = 'declared no-write preview';
    }
    return e;
}
function completeEvidence(v) {
    const text = (s) => typeof s === 'string' && s.length > 0;
    const list = (a) => Array.isArray(a) && a.every(text);
    return !!v && v.state === 'AVAILABLE' && v.coverage === 'COMPLETE' && list(v.required) && v.required.length > 0 && list(v.missing) && !v.missing.length && list(v.observed) && list(v.evidence_refs) && v.evidence_refs.length > 0 && text(v.activation) && text(v.revision) && text(v.observed_at) && text(v.verifier_version) && text(v.source) && !!v.scope && typeof v.scope === 'object' && !Array.isArray(v.scope) && v.required.every(f => v.observed.includes(f));
}
const ids = (v) => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0) && new Set(v).size === v.length;
function fastNoWrite(r) {
    return ids(r.created_ids) && ids(r.deleted_ids) && !r.created_ids.length && !r.deleted_ids.length && Array.isArray(r.item_results) && !r.item_results.length;
}
function fastComplete(r, payload) {
    return r.readback_verified === true && r.rollback_attempted === false && r.rollback_complete === false && !negativeResult(r) && fastSettled(r, payload, true);
}
function fastSettled(r, payload, complete) {
    if (r.mutation_started !== true || r.duplicate === true)
        return false;
    if (typeof r.revision_before !== 'string' || !r.revision_before.trim() || typeof r.revision_after !== 'string' || !r.revision_after.trim())
        return false;
    if (r.revision_before === r.revision_after || ('duplicate' in r && typeof r.duplicate !== 'boolean'))
        return false;
    if (!complete && r.readback_verified !== false)
        return false;
    if (r.rollback_complete === true && (r.rollback_attempted !== true || nonempty(r.deleted_ids)))
        return false;
    if ('base_revision' in payload && payload.base_revision !== r.revision_before)
        return false;
    if ('native_settled' in r && r.native_settled !== true)
        return false;
    if (typeof r.rollback_attempted !== 'boolean' || typeof r.rollback_complete !== 'boolean')
        return false;
    if (!ids(r.created_ids) || !ids(r.deleted_ids))
        return false;
    const items = r.item_results, ops = payload.operations;
    if (!Array.isArray(items) || !Array.isArray(ops) || !items.length || items.length !== ops.length)
        return false;
    if (!('failed_index' in r))
        return false;
    let failed = -1;
    if (complete) {
        if (r.failed_index !== null)
            return false;
    }
    else {
        if (typeof r.failed_index !== 'number' || !Number.isInteger(r.failed_index) || r.failed_index < 0 || r.failed_index >= items.length)
            return false;
        failed = r.failed_index;
    }
    const created = new Set(), deleted = new Set(), seen = new Set();
    for (let i = 0; i < items.length; i++) {
        const item = items[i], op = ops[i];
        if (!item || typeof item !== 'object' || item.index !== i || !op || typeof op !== 'object')
            return false;
        const add = ['add_trace', 'add_arc', 'add_via'].includes(op.type), del = ['delete_trace', 'delete_via'].includes(op.type);
        if (!add && !del)
            return false;
        const status = failed === i ? 'failed' : failed >= 0 && i > failed ? 'skipped' : 'applied';
        if (item.status !== status)
            return false;
        if (status !== 'applied') {
            if ('id' in item)
                return false;
            continue;
        }
        if (typeof item.id !== 'string' || !item.id || seen.has(item.id))
            return false;
        seen.add(item.id);
        if (add)
            created.add(item.id);
        else {
            if (op.id !== item.id)
                return false;
            deleted.add(item.id);
        }
    }
    return r.created_ids.length === created.size && r.deleted_ids.length === deleted.size && r.created_ids.every(id => created.has(id)) && r.deleted_ids.every(id => deleted.has(id));
}
function canonical(value) {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value) ?? 'undefined';
}
