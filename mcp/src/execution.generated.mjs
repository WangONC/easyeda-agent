// Generated from extension/src/execution.ts and the Go ActionSpec catalog. Do not edit.
const evidenceInventory = [
    {
        "field": "mutation_started",
        "test": "true",
        "facts": [
            "write"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "write_attempted",
        "test": "true",
        "facts": [
            "write"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "created_ids",
        "test": "nonempty",
        "facts": [
            "write"
        ],
        "sample": [
            "observed"
        ],
        "shape": "collection"
    },
    {
        "field": "deleted_ids",
        "test": "nonempty",
        "facts": [
            "write"
        ],
        "sample": [
            "observed"
        ],
        "shape": "collection"
    },
    {
        "field": "applied",
        "test": "nonempty",
        "facts": [
            "write"
        ],
        "sample": [
            "observed"
        ],
        "shape": "collection"
    },
    {
        "field": "item_results",
        "test": "applied",
        "facts": [
            "write"
        ],
        "sample": [
            {
                "index": 0,
                "status": "applied",
                "id": "observed"
            }
        ],
        "shape": "items"
    },
    {
        "field": "partial",
        "test": "true",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "notApplied",
        "test": "nonempty",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": [
            "remaining"
        ],
        "shape": "collection"
    },
    {
        "field": "survived",
        "test": "nonempty",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": [
            "remaining"
        ],
        "shape": "collection"
    },
    {
        "field": "survivedIds",
        "test": "nonempty",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": [
            "remaining"
        ],
        "shape": "collection"
    },
    {
        "field": "survivedTotal",
        "test": "positive",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": 1,
        "shape": "count"
    },
    {
        "field": "deleted",
        "test": "false",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": false,
        "shape": "boolean-or-collection"
    },
    {
        "field": "disconnected",
        "test": "false",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": false,
        "shape": "boolean"
    },
    {
        "field": "native_settled",
        "test": "false",
        "facts": [
            "unsettled"
        ],
        "sample": false,
        "shape": "boolean"
    },
    {
        "field": "native_settled",
        "test": "true",
        "facts": [
            "settled"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "write_attempted",
        "test": "false",
        "facts": [
            "absence"
        ],
        "sample": false,
        "shape": "boolean"
    },
    {
        "field": "verified",
        "test": "false",
        "facts": [
            "unknown",
            "negative"
        ],
        "sample": false,
        "shape": "boolean"
    },
    {
        "field": "unverified",
        "test": "nonempty",
        "facts": [
            "unknown",
            "negative"
        ],
        "sample": [
            "field"
        ],
        "shape": "collection"
    },
    {
        "field": "duplicate",
        "test": "true",
        "facts": [
            "unsettled"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "status",
        "test": "uncertain",
        "facts": [
            "unsettled",
            "negative"
        ],
        "sample": "uncertain",
        "shape": "string"
    },
    {
        "field": "status",
        "test": "partial",
        "facts": [
            "possible",
            "negative"
        ],
        "sample": "partial",
        "shape": "string"
    },
    {
        "field": "status",
        "test": "stale",
        "facts": [
            "unknown",
            "negative"
        ],
        "sample": "stale",
        "shape": "string"
    },
    {
        "field": "status",
        "test": "failed",
        "facts": [
            "unknown",
            "negative"
        ],
        "sample": "failed",
        "shape": "string"
    },
    {
        "field": "status",
        "test": "unverified",
        "facts": [
            "unknown",
            "negative"
        ],
        "sample": "unverified",
        "shape": "string"
    },
    {
        "field": "rollback_attempted",
        "test": "true",
        "facts": [
            "possible"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "rollbackAttempted",
        "test": "true",
        "facts": [
            "possible"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "rollback_complete",
        "test": "true",
        "facts": [
            "possible"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "rollbackComplete",
        "test": "true",
        "facts": [
            "possible"
        ],
        "sample": true,
        "shape": "boolean"
    },
    {
        "field": "visibilityApplied",
        "test": "false",
        "facts": [
            "incomplete",
            "negative",
            "verifiedNegative"
        ],
        "sample": false,
        "shape": "boolean"
    },
    {
        "field": "readback_verified",
        "test": "false",
        "facts": [
            "unknown"
        ],
        "sample": false,
        "shape": "boolean"
    }
];
const contracts = {
    "board.copy": {
        "version": "execution.v1.3",
        "hash": "1c4d93eb4b81b7ef995ed067c2169ba8bb2936a9ee72187425ac2869b9b2ad53",
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
        "version": "execution.v1.3",
        "hash": "f8abbf174cf2f8e6fbf98dc27a0118709577ad9e1c04d4a73564b24ce4ed4ffe",
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
        "version": "execution.v1.3",
        "hash": "334e5adfdf942cfeaaf0b170bbb807f9143005e87a2e6bd005333e6aa84538b9",
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
        "version": "execution.v1.3",
        "hash": "ee9eceb784ed6f4adfa2783ea6c2905a42e58ac7123734b10a815d90f0a0d40b",
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
        "version": "execution.v1.3",
        "hash": "868fa30974f918c084b1757ebd4f697ac8725520f9a5897d7f23cf7b04db7ffc",
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
        "version": "execution.v1.3",
        "hash": "1fc4a47e42810910001eadb3154dac8e0a5b80fc8a213fc3e495b6c0a5524cfd",
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
        "version": "execution.v1.3",
        "hash": "68c5b85721c92d513dad95c5f6352113a9b1934e3df57e2c7c9d125b31828ac5",
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
        "version": "execution.v1.3",
        "hash": "cecc5055c8817000ad6f18eb2843bc6a106162a6148e739f4ff008e0c7291348",
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
        "version": "execution.v1.3",
        "hash": "e862d91454dc23a93bd5b6950f9fbd5be49f9c81fbae3ad73b6ff31bab703d94",
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
        "version": "execution.v1.3",
        "hash": "1f04ea16a5b26a64b4aafaa7a62615ad0c04a882574bcf0bec8e18dd7edcb54b",
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
        "version": "execution.v1.3",
        "hash": "580769f805d8bf17b1a86718f543e48ba1f66cfb7108688d9eb139fed11e0e30",
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
        "version": "execution.v1.3",
        "hash": "40ac13d6f7aad52feb11f48b611584d697f2629cfc50a47955bcb933d7d9e136",
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
        "version": "execution.v1.3",
        "hash": "10dafd75c0e20148e5cdd742d70d8e7fa9905a302c8a4fdb5f0c99fd4f581a59",
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
        "version": "execution.v1.3",
        "hash": "0d5a6f27f526e84c546487f695b39ecf15e13930e3a142daea77609ce2f50efb",
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
        "version": "execution.v1.3",
        "hash": "26a6655b7326e1fcfc0752f1cd25d6a533e32b6ff7c69624470838c88daa45c5",
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
        "version": "execution.v1.3",
        "hash": "57d4a4b9d10105d182157073f5d3e762b787573168b60e1da33e22a8ee8745a4",
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
        "version": "execution.v1.3",
        "hash": "31ff9068ef30cda562dd4ab13f5c2eba592b7ecd838f018b9e5d44a3c17deeb3",
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
        "version": "execution.v1.3",
        "hash": "793c1b35a7414561b047fdb3a71f7444924d5236226517d518aeda7059e26248",
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
        "version": "execution.v1.3",
        "hash": "bce8f8168c4b9a774549d153da5415974771caaa989c34d8d4089c72ed1eabd5",
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
        "version": "execution.v1.3",
        "hash": "9112917f408e2e824b7c4e766dcda3b6c3640c4c15245e0b8aef26f57a2e8c8f",
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
        "version": "execution.v1.3",
        "hash": "144a9816dae79b42fe027c1f85f75bae4ebe9fd29abffc06191222775f0aaebc",
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
        "version": "execution.v1.3",
        "hash": "098cd76eea913a174d5a7c07bfaad6fbe2976ae950f3b52b30518266ec125bee",
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
        "version": "execution.v1.3",
        "hash": "cd3cd3eb45fb50f3322a79b8f1ad7865f7122dbba1faf5464948ff6510202b40",
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
        "version": "execution.v1.3",
        "hash": "33311bf061b5e3bc91738757f3ab7e98a7cd2e538d785a73c8380abde657998d",
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
        "version": "execution.v1.3",
        "hash": "6175d5a884109769b928bb22a55baa9c1694a50741273bf4580ac14841af91e2",
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
        "version": "execution.v1.3",
        "hash": "ab4e141dbc13e23757913bf7199f4c2fc78da2144d96be6d5c305bdb5983b6ad",
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
        "version": "execution.v1.3",
        "hash": "2358851a001db75cd4ca5b40fc8745adf3cf3a1322a84cc3fb04d73a555da52c",
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
        "version": "execution.v1.3",
        "hash": "9803b6c5daa8c8f406dc7eaba212fba2bb7f7ac4f89c8247c38d69a0d8bcd340",
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
        "version": "execution.v1.3",
        "hash": "f1b62721e113f51fc7090de99f3c7915406636cedbfbd2ec4e35b88ce5e3d257",
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
        "version": "execution.v1.3",
        "hash": "29ee8c28a581e6ae225394e775615b5f347ac08c70737c28a9aa59619e380b3b",
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
        "version": "execution.v1.3",
        "hash": "0021f89e9310c42330902df6547d609dc511f122d43ac072e5117d95542874fb",
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
        "version": "execution.v1.3",
        "hash": "83b8702a577a29aefcca8a918db4838e06ab28b05d678c88ba854e20fa529cee",
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
        "version": "execution.v1.3",
        "hash": "92fdec3a970d848db58e1e25de63de7a6f50558a3184571f8f6d096a43e114f0",
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
        "version": "execution.v1.3",
        "hash": "250282fcd7ca20e8398e5510aa8f27e13cd4e398146d8c93180e78872d90787c",
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
        "version": "execution.v1.3",
        "hash": "972496d0a10491fda47d2ef1661d8f542c967d0945b14c853e3483ccff4b57a9",
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
        "version": "execution.v1.3",
        "hash": "7f69618fae2636af5e7c91ee5ad9f1f188d6445ea3d0c29ee2a904776ab0acba",
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
        "version": "execution.v1.3",
        "hash": "9baf6585a235d44477b8214c736d2008e481331a2e51a6441a30edf40c021f69",
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
        "version": "execution.v1.3",
        "hash": "8f8ac3abb7b4e7131ac5f19ae92526a28cc71cdce742699c40bb7fb46a8e0d64",
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
        "version": "execution.v1.3",
        "hash": "a613035dcc6b69667e579efdc6fd4c462bf1c413d5a0227432bae0cbda9c9fe6",
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
        "version": "execution.v1.3",
        "hash": "1db0df6324444661773ccb07f05c83f796ca8012434dedfb9c1685a97187bbf5",
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
        "version": "execution.v1.3",
        "hash": "826596cf6df6fc446fca14ff0b2712f0983c8a36d88920d0c70531143062a209",
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
        "version": "execution.v1.3",
        "hash": "90b2d4c3f3503eff9fe739be908e7d3fe7abc35dc6781fc6b6dc32396143c08e",
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
        "version": "execution.v1.3",
        "hash": "7052a0519b632835919b6826ce9435d5a1815dc1e684ac6e20e66d24ef225c63",
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
        "version": "execution.v1.3",
        "hash": "12261fe135ddbfe57a353dd334c5372eeab5389e1cbb8f2d9951da149891cf94",
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
        "version": "execution.v1.3",
        "hash": "c94d5aacda2ab7f8e3800bb82bc347abd84950a9aefc0bac3246ed29198ae30a",
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
        "version": "execution.v1.3",
        "hash": "efcdb34f4e3bf75dcb334064ecb607b455e76f79e3f8f2eeda323e978eea20b4",
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
        "version": "execution.v1.3",
        "hash": "7bd9bef466b46bff86af959923f852238507367f47677f1813f5eb175ac7f33f",
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
        "version": "execution.v1.3",
        "hash": "1163c4ce0475fb7ccd9d965ab7a707cafb441c4bb664b934e27c108f7d237118",
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
        "version": "execution.v1.3",
        "hash": "7fbccfc175b364d076829227908f2c71f53ea8eef980036b6b35479f38baa954",
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
        "version": "execution.v1.3",
        "hash": "e472f868e6cf8ab84779b4f209d1c0d29d76065bbfad7a3fdf3125a1eb25d3c5",
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
        "version": "execution.v1.3",
        "hash": "1f8de9b0f362d1dda776ab9a55b7fee4cba45d7785e17729e060e138da2fa5d6",
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
        "version": "execution.v1.3",
        "hash": "1bfb09140e7787f58ec3f996c1646a7fafc4a3cceb8579c5e21a5cd95bbbf725",
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
        "version": "execution.v1.3",
        "hash": "5c90fa90efafead02156f0442f177402dcefc2eb7dbd7f2555a8a5381c7ae035",
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
        "version": "execution.v1.3",
        "hash": "ba87a42f0d47c956470d23f6ba7de69886a75ecf72186637614e149473e190a4",
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
        "version": "execution.v1.3",
        "hash": "66287122deb74f06b82632b4185520e64cf456390d869987b01a71e8b338be20",
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
        "version": "execution.v1.3",
        "hash": "c03e6e76202966213ff66918493819aa7e885e0de22fac3c44693bda59331714",
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
        "version": "execution.v1.3",
        "hash": "5b21498464d1ce5912ed12ab77e9acec184774721d9dcfe36b5647e78d5d1352",
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
        "version": "execution.v1.3",
        "hash": "8ba7262890665228949454312fa71fd6f747ec8218fe8da4831b2b2b0f3a64b8",
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
        "version": "execution.v1.3",
        "hash": "ad53b4847aaa349192b067bf0b02fb65c691aa97a7bc80b2f5d38f58a35d1cdf",
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
        "version": "execution.v1.3",
        "hash": "1f1b3d4b93b4d44d0dc3c80bc5fbcbb2335ad7717e59f7186146b75cd9e8eb25",
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
        "version": "execution.v1.3",
        "hash": "05807c021093099c7991d05daf221f99751914607319a6da9731b2997334a52f",
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
        "version": "execution.v1.3",
        "hash": "43d0534eec48def2bdaefeb691f4f39da5af00487c7de5e39c4f055a8fd5078b",
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
        "version": "execution.v1.3",
        "hash": "26e11c7b1dedd8956c0e2d7448782fb06ebae8b67c8aec342c909ba151575992",
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
        "version": "execution.v1.3",
        "hash": "7859c813bab2917c100890eb70d462ced9bc122b959e8239c23a295bbe29e745",
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
        "version": "execution.v1.3",
        "hash": "85c0065cad123f85c2103a3d180c39441e4a61eed5cf4ae2ae7429687d33a678",
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
        "version": "execution.v1.3",
        "hash": "e140095e8e6dcb4a6c79b1053a79aef729106af587dcc166e8ab4c235f253338",
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
        "version": "execution.v1.3",
        "hash": "c5ce26d1d21e83ef6aeccda99a7c3622777e2770dab784bbc24a002f3f81697a",
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
        "version": "execution.v1.3",
        "hash": "82497bafc098d07a6e2c3610bed03913ba167c2fdc9a9b88b681e9006da32c25",
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
        "version": "execution.v1.3",
        "hash": "8ae425ac5647c503fcc3759aee0b786552235119dce9361ca90398c4c39ebf28",
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
        "version": "execution.v1.3",
        "hash": "d2ce0d11dd761d5cb525181d6c5a701219814023658a31852017c29797117a37",
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
        "version": "execution.v1.3",
        "hash": "b2b90d8b8845b2983c493a07df901b941a7b1c6c912899b267ab781bdf1cb7f6",
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
        "version": "execution.v1.3",
        "hash": "5fd94a686d3d75721c85373bd12cb27b6a3383c3ce7c111c129aa537df555893",
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
        "version": "execution.v1.3",
        "hash": "a93b5c61598d3185458b0215012c462af3c5fad4bc7f4c88bfc772cf33155af9",
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
        "version": "execution.v1.3",
        "hash": "920861e7dcc19876e44e5825f1bf0340c97b1de76289da9a2d8ca8d1bb1323de",
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
        "version": "execution.v1.3",
        "hash": "48369c111086a0bc70580d3ede08f6661af0bd00f0dc9a80974223b35e7b7930",
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
        "version": "execution.v1.3",
        "hash": "061cccab7e26879352d03c4fa6d5293249ddd2e7d680eb8dd1c337d3249e0acb",
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
        "version": "execution.v1.3",
        "hash": "46552921549ebaa9011109457a226428428f14786bab707a9b2a73ce765b1321",
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
        "version": "execution.v1.3",
        "hash": "dfad7099a9ab3e0918fea8a1385903ad6603201d45492147f1be2be463c789f5",
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
        "version": "execution.v1.3",
        "hash": "bc6c03ef68b0af4650821e594ae3a3144cd6956b4f828dd9be059d0fcc096290",
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
        "version": "execution.v1.3",
        "hash": "937d806287f005d04cf8b46302ecabfefaa9760eacba107681687221d375f90d",
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
        "version": "execution.v1.3",
        "hash": "20db1cd4cca3c3917b506027e1061a31681248fa2c8d3bb482edd9068f7b5cc3",
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
        "version": "execution.v1.3",
        "hash": "52f14ca175de362d8ab19857f255fda00c4108318e86e6f4b41ac3a339107b2e",
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
        "version": "execution.v1.3",
        "hash": "ef9b4af2efb06b4973b8e6d383e20d2feff0bc691aa7b778517ecb8998117e6a",
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
        "version": "execution.v1.3",
        "hash": "e73845e1c6ea1b9da5309b967d46882a48f3c9b606a26fc0ffff7bc629816d4e",
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
        "version": "execution.v1.3",
        "hash": "a371a8dbd31ecc4112be449b4fcb902a268faf1b5eb5bd7e741716506f170b83",
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
        "version": "execution.v1.3",
        "hash": "f0b6f222c3c988397131d9c81d4d04957263271abef2f376e5967bea177ff575",
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
        "version": "execution.v1.3",
        "hash": "cee7b1ad220d2d7ddb96ba3eaec69b77fa8adf1ec7ccbd4d4c3ae167d687c0e4",
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
        "version": "execution.v1.3",
        "hash": "65732bf2cd41d2749a7d87df6c62b9473893735cc11310ea005f3c407b152d95",
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
        "version": "execution.v1.3",
        "hash": "769275531b277f4619c4891b58ed3c87cd767c491e35094fbd1c30c6e9b0cff7",
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
        "version": "execution.v1.3",
        "hash": "22228dbc991634d589c546f70066a115ed5d71b7760974dcd302fd7ac6aa105e",
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
        "version": "execution.v1.3",
        "hash": "38e6e57301a35ad74db4a56af10c0c0e2a29ee91b736a01eab0403dab4193a5b",
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
        "version": "execution.v1.3",
        "hash": "018b59d6df66fb3541ca35f120114d6972c1de0e82ddeb94ac840e9f3b4812c3",
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
        "version": "execution.v1.3",
        "hash": "49a4b32beb59935d8ad72614d965c1a0a0e7bc57ebad9487b6c48d001f725c1c",
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
        "version": "execution.v1.3",
        "hash": "0e2325aa053378806aebae175731354b039a4e3ca0a00e1f5f93c98dfc8f2b87",
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
        "version": "execution.v1.3",
        "hash": "3aa64e59ec97aca7cb1884e56e7f0e2e45daf7f1f8f7eb58090d95af0ad38ffc",
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
        "version": "execution.v1.3",
        "hash": "fa619de7785ff93704438ea462447dd25146ab094f1e2ed38cbbd5b6dbe697f2",
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
        "version": "execution.v1.3",
        "hash": "609a85bf8e31ea6aba5ab19e02b803e172de45a2f0d5412ef6f30f1f3ab021b8",
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
        "version": "execution.v1.3",
        "hash": "88072ab84978e32c2f9cb04343bdb18dc15bf3a2a8fd2d8caebcb105f564154f",
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
        "version": "execution.v1.3",
        "hash": "f0f1a07b222f2f276044d174424080383f0e445df90880eec42ba1907d6d32d5",
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
        "version": "execution.v1.3",
        "hash": "103643b2740374abaefaae1b61616b11b11630fa62c5aed6ba3184755c22969b",
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
        "version": "execution.v1.3",
        "hash": "a1140589b88e10f2aaf6a95251a91c1650687df92909c52b43a05ec1fef31a83",
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
        "version": "execution.v1.3",
        "hash": "5f64d86bb6c9f04cd04d95ab71073ea2ee343a10e7664b8b1836e9e87bad5584",
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
        "version": "execution.v1.3",
        "hash": "1b60d259ef472f1db1261d74cc774351ae6ea663e8e8944c51b3d2ee87ad7955",
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
        "version": "execution.v1.3",
        "hash": "be72ef6abb07b0edd38f3b8a0e19003338d7604a1d6167cd633f0e3624606b48",
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
        "version": "execution.v1.3",
        "hash": "4b46f58b27d5b26a0e9db233abe28b0b03c51de3cfd4ce507c808869872df415",
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
        "version": "execution.v1.3",
        "hash": "87d222397bb30362107deba148561a7817fa1af56da1a6436ef1d9c96d7438ae",
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
        "version": "execution.v1.3",
        "hash": "854537c125d54e7874fddaac2ffa4d50f07f953d5c40b642c422ac1aff12dba3",
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
        "version": "execution.v1.3",
        "hash": "e603295649732e0667e0083351a37057654c8ebe535126c8681213ad3bbb638b",
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
        "version": "execution.v1.3",
        "hash": "9a4df45105084a45eb835c3787de13df1b1948fff6d2ccd17001a833ce33a3d5",
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
        "version": "execution.v1.3",
        "hash": "68f7e4686026cfc5aaf1a352f17bd440fef8450dbc441d38aca2f5f629ec8ad9",
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
        "version": "execution.v1.3",
        "hash": "4876b81e7fa8009be347adb70944a3050ce450aba0a1dfb94c45432f35386e55",
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
        "version": "execution.v1.3",
        "hash": "596557d0e466fa8f0425896069d7b6b1dd7909ef4f2265d8a101036b32bb1405",
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
        "version": "execution.v1.3",
        "hash": "966b45c581798b5b75c5ddbf0e2d151ace4f929034fade4f8ad8ffe10af09b1e",
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
        "version": "execution.v1.3",
        "hash": "9e2305512e9458e2b08cd1c9dee2a38d25052d20ff736d0e110810705cebc249",
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
        "version": "execution.v1.3",
        "hash": "499a2ea45e43d84254f842c004df6d0e3b1ef94eef81d6bee574d8153f9d30fe",
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
        "version": "execution.v1.3",
        "hash": "c68760c62d96bd2086c96eaa7d0c90235891216cf3f25dbafd1e3b915ae0b11e",
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
        "version": "execution.v1.3",
        "hash": "7d8ed777b02490cf4673efe14395e310eaff36b20bc6192ff238e669c2b48c98",
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
        "version": "execution.v1.3",
        "hash": "7f9305edc8d1068e08c36af818377b386ce4e2cb801e405498a4ad473aaa3774",
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
        "version": "execution.v1.3",
        "hash": "43f831d635615f2755a31f33177836bc94da4ede4842070dde8d6c14466567d8",
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
        "version": "execution.v1.3",
        "hash": "ff32e9da22338b841f3a91a090bf7eab5ee35eef11c7a15c3ca2c1a6e229c199",
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
        "version": "execution.v1.3",
        "hash": "251c44730e89f0978b4e85936002864f9aca18fb693e40f89fb054ea4357b7ab",
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
        "version": "execution.v1.3",
        "hash": "7b6463ef8ab6fea13971e93decce8ad210f080db82cd717df9fcc56f70f0e380",
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
        "version": "execution.v1.3",
        "hash": "f9af6d6b03ff3bb727283cd6ad302affc5c4e4e14e359b7012f7948e0421a7bf",
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
        "version": "execution.v1.3",
        "hash": "84f08c5bcf77fbfc0ca442d97b1ab6d753e44468dec2961875d3207e0858f428",
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
        "version": "execution.v1.3",
        "hash": "4a4c3dabfad23f008ef78d64f191b99a391a640af0575eb58dd03e521daf36d4",
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
        "version": "execution.v1.3",
        "hash": "bf36d4550c4fdf5d396b46e65d44683ab6d997ef72d5d7a3995636f1fb792cfe",
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
        "version": "execution.v1.3",
        "hash": "3f2e8be1436d8a48ac89667ce083c1fbcbb6b324627e6778bbc02d4217fa3bfa",
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
        "version": "execution.v1.3",
        "hash": "4262859db5c05840a163c7b3b6d7168ccfce30e419a0f5baf7fe3d9285486409",
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
        "version": "execution.v1.3",
        "hash": "ba50489109c23712221643e24a8c6ab6dea132afaa234369f0e226f226a48707",
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
        "version": "execution.v1.3",
        "hash": "39e0d0a74036b3f6e9d9933c9d7bade1a1419849ad4d3d5e283603cfd3b20637",
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
        "version": "execution.v1.3",
        "hash": "ef0f74c90a67f628d11075c339bbd404c1d4bd03ccffd08e992b24f9cf733cbb",
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
        "version": "execution.v1.3",
        "hash": "ecd5440cf7bb8a9a6ceb0faf20ce9619284507649d9ed2de9baa4e8205ba057c",
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
        "version": "execution.v1.3",
        "hash": "15b48e0933f5202261fd2c52730b3ee608fed27c831ba84b91210b99775c2539",
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
        "version": "execution.v1.3",
        "hash": "f237d7a02978aa68f4c2732d441f931c740f52f68e0f3f4381a626a3ddefd81e",
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
        "version": "execution.v1.3",
        "hash": "a1387357edd30e611328ab2947f525ad5807cd5161f2781d57db09329a168f09",
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
        "version": "execution.v1.3",
        "hash": "83586ed3354c64d3d35b851b9a0fd4141f0bf8d03be25670252f0a421418bedb",
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
        "version": "execution.v1.3",
        "hash": "5a841766921445542d6530cd62fdea8ec1d1d7884bccfdf1f7928c207bb765a0",
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
        "version": "execution.v1.3",
        "hash": "54165e51592286dafbdfdd172d841219e802acf98c6f30aef764d2bba6797bb0",
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
        "version": "execution.v1.3",
        "hash": "a691199eab967051babdb388249b073309ca5b30a61e6397597b40972b6ab2eb",
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
        "version": "execution.v1.3",
        "hash": "490780c6982720d5a6991edc6a390c633ee67f219acbff4c5e4db35fb147cbd3",
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
        "version": "execution.v1.3",
        "hash": "b54acc8d4a60cdfd712625e52d9c0c909cf92c5255fefd2cea2170be5b1158e6",
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
        "version": "execution.v1.3",
        "hash": "3d60b310d445f474ddc5afdfd084775532880a7ef0b5cb9022c09b7dbdeffd19",
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
        "version": "execution.v1.3",
        "hash": "ace1638972a9db7cfdce2f87ae118decf451666053049d031ff09ee21f4a8473",
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
        "version": "execution.v1.3",
        "hash": "00bb19f669335bface3b72ac347d57e7e0708a56b47ea8ab6c95d1a19cdb5dc1",
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
        "version": "execution.v1.3",
        "hash": "19d9b3c1082e1745784ec263d3d50d04bd0f09d6bc9aa4de58a244d360b0c271",
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
        "version": "execution.v1.3",
        "hash": "e059a6382ad1ec9e71f9c81db96af994ca6dd15a4f7081e42daa15cd8f6de88e",
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
        "version": "execution.v1.3",
        "hash": "9b10f8f40670ceb3088a45c5a6b8c27613281f48541e748de0d10f273d60e6e6",
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
        "version": "execution.v1.3",
        "hash": "f6054bcd3968c23718acd80bcb5585b041be891d195d760dae9765685184ce31",
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
        "version": "execution.v1.3",
        "hash": "2efacec24646bbfaf0ee4fead23d339ff192169a0f92ba3d95c94dd873be9d25",
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
        "version": "execution.v1.3",
        "hash": "e876802e376d7ed57a339e13c06f874951aedad5bd2701438d113dab6fb58247",
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
        "version": "execution.v1.3",
        "hash": "137f16453f9ec19ce0fb9302bb4547f37fda7da129ebfe2b720178845a7dca52",
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
    return !!adaptEvidence(r).negative;
}
export function interpret(req, resp, before = false) {
    return deriveExecution(reconcileExecution(validateExecution(req, resp, before)));
}
function emptyExecution(req, c) {
    return { operation_id: req.operationId || req.payload?.client_transaction_id, parent_operation_id: req.parentOperationId, request_id: req.id || '', contract_version: c?.version || '', contract_hash: c?.hash || '', expected_target: req.expectedTarget, verification: { state: 'UNAVAILABLE', coverage: 'PARTIAL', required: [], observed: [], missing: [], evidence_refs: [] }, recovery: { state: 'NOT_REQUESTED' }, persistence: { state: 'NOT_REQUESTED' }, request_satisfied: false, next_action: '', reason: '', possible_effect: false, autosave_eligible: false, health_effect: 'UNKNOWN', freshness_restored: false };
}
function validateExecution(req, resp, before) {
    const c = contractFor(req.action), meta = emptyExecution(req, c);
    meta.observed_target_after = resp?.context;
    const f = { req, resp, c, raw: resp?.result || {}, prior: resp?.execution, meta, before, preview: req.payload?.dryRun === true && c?.dry_run === 'preview', mutation: !!c?.effects.some(e => ['DESIGN_CONTENT', 'PROJECT_TOPOLOGY', 'LIBRARY_ASSET'].includes(e)), effectful: !!c?.effects.length, observed: false, unsettled: false, priorUncertain: false, negative: false, issue: '', basis: '' };
    f.receipt = normalizeReceipt(f);
    f.observed = !!f.receipt.side.write;
    f.unsettled = !!f.receipt.side.unsettled;
    f.possible = !!f.receipt.side.possible;
    f.incomplete = !!f.receipt.side.incomplete;
    f.absence = !!f.receipt.side.absence;
    if (f.prior != null) {
        f.effectful ||= f.prior.possible_effect === true;
        const prior = f.prior;
        if (validExecutionShape(prior) && prior.decision_basis === 'REFUSED' && prior.contract_version === (c?.version || '') && prior.contract_hash === (c?.hash || '') && prior.request_id === (req.id || '') && prior.request_id === (resp?.id || '') && prior.write_attempted === false && prior.possible_effect === false && !prior.request_satisfied && (prior.mutation_outcome === 'NO_WRITE' || !f.mutation && !prior.mutation_outcome))
            f.before = true;
        const p = f.prior, evidence = validExecutionShape(p) ? (p.invalid_evidence ?? p) : p;
        const side = adaptEvidence(evidence), wrote = !!side.write, pending = !!side.unsettled;
        f.possible ||= !!side.possible;
        f.incomplete ||= !!side.incomplete;
        f.observed ||= wrote;
        f.unsettled ||= pending;
        if (p.invalid_evidence != null || !validExecutionShape(evidence)) {
            f.invalid = evidence;
            f.issue = 'INVALID';
            if (p.invalid_evidence != null && validExecutionShape(p))
                f.meta = structuredClone(p);
        }
        else {
            f.meta = structuredClone(p);
            f.priorUncertain = p.mutation_outcome === 'UNCERTAIN';
            if (p.contract_version !== c?.version || p.contract_hash !== c?.hash || p.request_id !== (resp?.id || '') || (req.id && req.id !== resp?.id))
                f.issue = 'CONFLICT';
            if (!f.mutation && p.mutation_outcome) {
                f.issue = 'CONFLICT';
                f.effectful = true;
            }
        }
    }
    if (!validRawEvidence(resp?.result, req.action)) {
        f.invalid = { result: resp?.result ?? null };
        f.issue = 'INVALID';
    }
    if (!c || (req.contractVersion && req.contractVersion !== c.version) || (req.contractHash && req.contractHash !== c.hash)) {
        if (f.issue !== 'INVALID')
            f.issue = 'CONFLICT';
    }
    if (req.payload && 'dryRun' in req.payload && typeof req.payload.dryRun !== 'boolean') {
        f.issue = 'INVALID';
        f.invalid = { payload: req.payload };
    }
    if (req.payload?.dryRun === true && c?.dry_run !== 'preview' && !before)
        f.issue = 'CONFLICT';
    if (f.observed || f.unsettled || f.possible || f.incomplete)
        f.effectful = true;
    f.negative = !!f.receipt.side.negative;
    return f;
}
function reconcileExecution(f) {
    const p = f.prior, n = f.receipt;
    const risk = f.observed || f.possible || f.incomplete || f.unsettled;
    const choose = (basis) => { f.basis = basis; return f; };
    if (f.before && !risk && !f.priorUncertain)
        return choose('REFUSED');
    if (p?.decision_basis === 'CONFLICT' && f.issue !== 'INVALID')
        return choose('CONFLICT');
    if (f.issue)
        return choose(f.issue);
    if (((f.preview || f.before) && risk) || (f.absence && risk))
        return choose('CONFLICT');
    if (p) {
        const v = p.verification;
        const persistence = p.persistence.state, save = !!f.c?.effects.includes('SAVE'), delivery = !!f.c?.effects.includes('ARTIFACT_DELIVERY');
        if ((!['NOT_REQUESTED', 'UNKNOWN'].includes(String(persistence)) && !save && !delivery) || (persistence === 'SAVE_ACKNOWLEDGED' && !save) || (['DELIVERED', 'PENDING_DELIVERY', 'DELIVERY_FAILED'].includes(String(persistence)) && !delivery) || (v.state === 'UNAVAILABLE' && v.coverage === 'COMPLETE') || (p.mutation_outcome === 'NO_WRITE' && (p.possible_effect || p.write_attempted !== false)) || (p.mutation_outcome === 'COMPLETE' && (!p.request_satisfied || p.native_settled !== true || p.write_attempted !== true)) || (p.mutation_outcome === 'PARTIAL' && p.request_satisfied))
            return choose('CONFLICT');
        if (p.recovery.state !== 'NOT_REQUESTED' && f.req.action !== 'route.apply_batch')
            return choose('UNRESOLVED');
        if (persistence === 'DELIVERY_FAILED')
            return choose('DELIVERY_FAILED');
        const missing = v.missing.length > 0 || (v.required.length > 0 && (v.coverage !== 'COMPLETE' || !v.required.every(x => v.observed.includes(x)))) || (v.state === 'AVAILABLE' && v.coverage !== 'COMPLETE');
        if (v.state === 'INVALID')
            return choose('INVALID');
        if (v.state === 'UNSUPPORTED' || missing)
            return choose('UNRESOLVED');
        if ((p.mutation_outcome === 'NO_WRITE' || p.write_attempted === false) && risk)
            return choose('CONFLICT');
        if (f.req.action === 'route.apply_batch') {
            if (n.recoveryConflict)
                return choose('CONFLICT');
            if (n.itemsConflict)
                return choose('CONFLICT');
        }
    }
    if (f.unsettled)
        return choose('UNRESOLVED');
    if (f.priorUncertain) {
        if (['UNVERIFIED', 'LEGACY_NEGATIVE'].includes(p?.decision_basis || '') && f.req.action !== 'route.apply_batch' && !f.preview)
            return choose(f.negative ? 'LEGACY_NEGATIVE' : 'UNVERIFIED');
        return choose('UNRESOLVED');
    }
    if (p?.decision_basis === 'REFUSED' && p.write_attempted === false && !risk)
        return choose('REFUSED');
    if (n.side.unknown && (f.preview || f.absence))
        return choose('UNRESOLVED');
    if (f.preview)
        return choose(f.absence || (p?.mutation_outcome === 'NO_WRITE' && p.write_attempted === false) ? 'PREVIEW' : 'UNRESOLVED');
    if (p?.mutation_outcome === 'NO_WRITE' && p.write_attempted === false && !risk)
        return choose(p.decision_basis === 'REFUSED' ? 'REFUSED' : 'NO_WRITE');
    if (f.absence && !risk)
        return choose('NO_WRITE');
    if (f.mutation) {
        if (f.req.action === 'route.apply_batch') {
            if (n.fastNoWrite)
                return choose('NO_WRITE');
            if (n.fastPartial)
                return choose('FAST_PARTIAL');
            if (n.fastComplete)
                return choose('FAST_COMPLETE');
            return choose('UNRESOLVED');
        }
        return choose(f.negative ? 'LEGACY_NEGATIVE' : 'UNVERIFIED');
    }
    if (risk && !f.c?.effects.length)
        return choose('CONFLICT');
    let satisfied = n.acknowledged && !f.negative;
    if (p && !p.request_satisfied && p.persistence.state !== 'PENDING_DELIVERY')
        satisfied = false;
    if (f.c?.effects.includes('SAVE'))
        satisfied &&= n.saveAcknowledged;
    if (f.c?.effects.includes('ARTIFACT_DELIVERY')) {
        const delivered = satisfied && n.delivered;
        const pending = n.pending;
        return choose(delivered ? 'DELIVERED' : satisfied && pending ? 'PENDING_DELIVERY' : 'DELIVERY_FAILED');
    }
    return choose(satisfied ? 'SATISFIED' : 'REJECTED');
}
function deriveExecution(f) {
    const e = f.meta, b = f.basis;
    if (b === 'CONFLICT' && e.prior_evidence == null && f.prior && f.prior.decision_basis !== 'CONFLICT')
        e.prior_evidence = structuredClone(f.prior);
    e.decision_basis = b;
    delete e.mutation_outcome;
    e.request_satisfied = false;
    e.next_action = 'inspect';
    e.reason = 'request not satisfied';
    e.possible_effect = f.effectful || f.observed;
    e.autosave_eligible = false;
    e.health_effect = 'UNKNOWN';
    e.freshness_restored = false;
    if (f.mutation)
        e.mutation_outcome = 'UNCERTAIN';
    if (f.invalid != null) {
        e.invalid_evidence = f.invalid;
        e.verification.state = 'INVALID';
    }
    if (f.unsettled)
        e.native_settled = false;
    if ((f.possible || f.incomplete || f.unsettled) && e.write_attempted === false)
        delete e.write_attempted;
    if (f.observed)
        e.write_attempted = true;
    e.observed_target_after ??= f.resp?.context;
    switch (b) {
        case 'INVALID':
        case 'CONFLICT':
        case 'UNRESOLVED':
            e.next_action = 'reconcile_without_replay';
            e.reason = b === 'INVALID' ? 'invalid execution evidence' : b === 'CONFLICT' ? 'conflicting execution evidence' : 'execution evidence is unresolved';
            if (b === 'INVALID')
                e.verification.state = 'INVALID';
            break;
        case 'REFUSED':
        case 'NO_WRITE':
        case 'PREVIEW':
            e.possible_effect = false;
            e.write_attempted = false;
            if (f.mutation)
                e.mutation_outcome = 'NO_WRITE';
            e.reason = 'no write established';
            if (b === 'REFUSED')
                e.reason = 'refused before dispatch';
            if (b === 'PREVIEW') {
                e.request_satisfied = f.receipt.acknowledged && !f.negative;
                e.reason = 'declared no-write preview';
            }
            break;
        case 'FAST_COMPLETE':
        case 'FAST_PARTIAL':
            e.possible_effect = true;
            e.native_settled = true;
            e.write_attempted = true;
            e.item_results = f.receipt.items;
            e.mutation_outcome = 'PARTIAL';
            e.health_effect = 'NOT_LANDED';
            e.next_action = 'reconcile_without_replay';
            e.reason = 'Fast Path partial receipt';
            if (b === 'FAST_COMPLETE') {
                e.mutation_outcome = 'COMPLETE';
                e.request_satisfied = true;
                e.health_effect = 'LANDED';
                e.reason = 'Fast Path semantic readback';
                e.verification.state = 'AVAILABLE';
                e.verification.coverage = 'COMPLETE';
                if (!e.verification.source)
                    e.verification.source = 'FastPath.matchesOperation';
                if (!e.verification.evidence_refs.length)
                    e.verification.evidence_refs = ['result'];
            }
            if (f.receipt.restored) {
                e.recovery.state = 'RESTORED';
                if (!('evidence_refs' in e.recovery))
                    e.recovery.evidence_refs = ['result'];
            }
            e.autosave_eligible = true;
            break;
        case 'UNVERIFIED':
        case 'LEGACY_NEGATIVE':
            e.next_action = 'reconcile_without_replay';
            e.reason = 'legacy evidence does not prove semantic completion';
            e.autosave_eligible = f.receipt.acknowledged;
            if (b === 'LEGACY_NEGATIVE' && f.receipt.side.verifiedNegative)
                e.health_effect = 'NOT_LANDED';
            break;
        case 'SATISFIED':
        case 'DELIVERED':
            e.request_satisfied = true;
            e.reason = 'request satisfied';
            break;
        case 'PENDING_DELIVERY':
            e.reason = 'artifact delivery evidence pending';
            break;
    }
    if (f.c?.effects.includes('SAVE') && !f.mutation)
        e.persistence.state = e.request_satisfied ? 'SAVE_ACKNOWLEDGED' : 'UNKNOWN';
    if (b === 'DELIVERED' || b === 'PENDING_DELIVERY')
        e.persistence.state = b;
    if (b === 'DELIVERY_FAILED') {
        e.persistence.state = b;
        e.reason = 'artifact delivery failed';
    }
    if (e.request_satisfied)
        e.next_action = 'continue';
    if (!f.mutation && f.req.action === 'pcb.pour.rebuild' && e.request_satisfied) {
        e.autosave_eligible = true;
        e.freshness_restored = true;
    }
    if (f.req.action === 'debug.exec_js' && b === 'UNVERIFIED' && f.receipt.acknowledged)
        e.freshness_restored = f.receipt.reload;
    return JSON.parse(JSON.stringify(e));
}
// Shared inventory: composable input facts, never request intent or outcomes.
function adaptEvidence(v, prewriteFast = false) {
    const facts = {};
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return facts;
    const r = v;
    for (const a of evidenceInventory) {
        if (prewriteFast && ((a.field === 'status' && ['partial', 'stale'].includes(a.test)) || a.field === 'readback_verified'))
            continue;
        if (!(a.field in r))
            continue;
        const value = r[a.field];
        const matched = a.test === 'true' ? value === true : a.test === 'false' ? value === false : a.test === 'nonempty' ? nonempty(value) : a.test === 'positive' ? typeof value === 'number' && value > 0 : a.test === 'applied' ? Array.isArray(value) && value.some(x => x && x.status === 'applied') : value === a.test;
        if (matched)
            for (const fact of a.facts)
                facts[fact] = true;
    }
    return facts;
}
function normalizeReceipt(f) {
    const r = f.raw, p = f.prior, fast = f.req.action === 'route.apply_batch';
    const noWrite = fast && ['stale', 'partial'].includes(r.status) && r.mutation_started === false && fastNoWrite(r);
    const side = adaptEvidence(r, noWrite);
    if (!(f.c?.dry_run === 'preview' && f.preview && r.dryRun === true && r.native_settled === true))
        delete side.absence;
    if (noWrite)
        side.absence = true;
    return {
        side, fastNoWrite: noWrite,
        fastPartial: fast && r.status === 'partial' && fastSettled(r, f.req.payload || {}, false),
        fastComplete: fast && r.status === 'complete' && fastComplete(r, f.req.payload || {}),
        recoveryConflict: fast && !!p && ((r.status === 'complete' && p.recovery?.state !== 'NOT_REQUESTED') || (p.recovery?.state === 'RESTORED' && (r.rollback_attempted !== true || r.rollback_complete !== true))),
        itemsConflict: fast && p?.item_results != null && canonical(p.item_results) !== canonical(r.item_results),
        acknowledged: f.resp?.ok === true && r.ok !== false && r.saved !== false,
        saveAcknowledged: r.saved === true, restored: r.rollback_complete === true, items: r.item_results,
        delivered: !!f.resp?.artifacts?.length && f.resp.artifacts.every(a => !!a.path && !!a.sha256),
        pending: !!f.resp?.artifacts?.length && f.resp.artifacts.every(a => (!!a.path && !!a.sha256) || !!a.inlineBase64),
        reload: f.req.action === 'debug.exec_js' && typeof f.req.payload?.code === 'string' && f.req.payload.code.includes('closeDocument'),
    };
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
function validExecutionShape(raw) {
    const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
    const list = (x) => Array.isArray(x) && x.every(v => typeof v === 'string');
    if (!object(raw) || !object(raw.verification))
        return false;
    if ('decision_basis' in raw && (!['possible_effect', 'autosave_eligible', 'freshness_restored'].every(k => typeof raw[k] === 'boolean') || !enumField(raw, 'health_effect', ['UNKNOWN', 'LANDED', 'NOT_LANDED'], false)))
        return false;
    for (const k of ['request_id', 'contract_version', 'contract_hash', 'next_action', 'reason'])
        if (typeof raw[k] !== 'string')
            return false;
    if (typeof raw.request_satisfied !== 'boolean')
        return false;
    for (const k of ['operation_id', 'parent_operation_id', 'payload_hash', 'activation', 'executor_build'])
        if (k in raw && typeof raw[k] !== 'string')
            return false;
    for (const k of ['native_settled', 'write_attempted', 'possible_effect', 'autosave_eligible', 'freshness_restored'])
        if (k in raw && typeof raw[k] !== 'boolean')
            return false;
    if (!enumField(raw, 'mutation_outcome', ['NO_WRITE', 'COMPLETE', 'PARTIAL', 'UNCERTAIN'], true) || !enumField(raw, 'health_effect', ['UNKNOWN', 'LANDED', 'NOT_LANDED'], true) || !enumField(raw, 'next_action', ['', 'inspect', 'continue', 'reconcile_without_replay'], false) || !enumField(raw, 'decision_basis', decisionBases, true))
        return false;
    for (const k of ['expected_target', 'observed_target_before', 'observed_target_after'])
        if (k in raw && !contextShape(raw[k]))
            return false;
    if ('affected_targets' in raw && (!Array.isArray(raw.affected_targets) || !raw.affected_targets.every(contextShape)))
        return false;
    if ('item_results' in raw && !validItems(raw.item_results))
        return false;
    if ('child_responses' in raw && (!Array.isArray(raw.child_responses) || !raw.child_responses.every(x => object(x) && validChildResponse(x) && (!('execution' in x) || x.execution == null || validExecutionShape(x.execution)))))
        return false;
    const v = raw.verification;
    if (!['AVAILABLE', 'UNAVAILABLE', 'INVALID', 'UNSUPPORTED'].includes(v.state) || !['COMPLETE', 'PARTIAL'].includes(v.coverage))
        return false;
    for (const k of ['required', 'observed', 'missing', 'evidence_refs'])
        if (!list(v[k]))
            return false;
    for (const k of ['source', 'revision', 'activation', 'observed_at', 'verifier_version'])
        if (k in v && typeof v[k] !== 'string')
            return false;
    if ('scope' in v) {
        if (!object(v.scope))
            return false;
        for (const k of ['projectUuid', 'projectName', 'documentUuid', 'documentType', 'tabId', 'unit'])
            if (k in v.scope && typeof v.scope[k] !== 'string')
                return false;
    }
    for (const k of ['recovery', 'persistence']) {
        const obj = raw[k];
        const states = k === 'recovery' ? ['NOT_REQUESTED', 'RESTORED', 'PARTIAL', 'FAILED', 'PENDING', 'UNKNOWN'] : ['NOT_REQUESTED', 'UNKNOWN', 'SAVE_ACKNOWLEDGED', 'PENDING_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED'];
        if (!object(obj) || !enumField(obj, 'state', states, false))
            return false;
        if ('evidence_refs' in obj && !list(obj.evidence_refs))
            return false;
    }
    return true;
}
const decisionBases = ['REFUSED', 'NO_WRITE', 'PREVIEW', 'FAST_COMPLETE', 'FAST_PARTIAL', 'UNVERIFIED', 'LEGACY_NEGATIVE', 'SATISFIED', 'REJECTED', 'DELIVERED', 'PENDING_DELIVERY', 'DELIVERY_FAILED', 'INVALID', 'CONFLICT', 'UNRESOLVED'];
function enumField(o, k, allowed, optional) { return !(k in o) ? optional : typeof o[k] === 'string' && allowed.includes(o[k]); }
function contextShape(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x))
        return false;
    const o = x;
    return ['projectUuid', 'projectName', 'documentUuid', 'documentType', 'tabId', 'unit'].every(k => !(k in o) || typeof o[k] === 'string');
}
function validItems(x) { return Array.isArray(x) && x.every(v => v && typeof v === 'object' && !Array.isArray(v) && (!('index' in v) || (typeof v.index === 'number' && Number.isInteger(v.index) && v.index >= 0)) && (!('status' in v) || typeof v.status === 'string') && (!('id' in v) || typeof v.id === 'string')); }
function validRawEvidence(raw, action) {
    if (raw == null)
        return true;
    if (typeof raw !== 'object' || Array.isArray(raw))
        return false;
    const r = raw;
    for (const a of evidenceInventory) {
        if (!(a.field in r))
            continue;
        const v = r[a.field], collection = !!v && typeof v === 'object';
        const valid = a.shape === 'boolean' ? typeof v === 'boolean' : a.shape === 'string' ? typeof v === 'string' : a.shape === 'collection' ? collection : a.shape === 'boolean-or-collection' ? typeof v === 'boolean' || collection : a.shape === 'count' ? typeof v === 'number' && Number.isInteger(v) && v >= 0 : a.shape === 'items' && validItems(v);
        if (!valid)
            return false;
    }
    for (const k of ['ok', 'saved', 'dryRun', 'partial', 'verified', 'disconnected', 'mutation_started', 'readback_verified', 'rollback_attempted', 'rollback_complete', 'duplicate', 'native_settled', 'write_attempted'])
        if (k in r && typeof r[k] !== 'boolean')
            return false;
    if ('deleted' in r && typeof r.deleted !== 'boolean' && (!r.deleted || typeof r.deleted !== 'object'))
        return false;
    if ('status' in r && (typeof r.status !== 'string' || (action === 'route.apply_batch' && !enumField(r, 'status', ['complete', 'partial', 'uncertain', 'stale'], false))))
        return false;
    for (const k of ['created_ids', 'deleted_ids'])
        if (k in r && !ids(r[k]))
            return false;
    if ('item_results' in r && !validItems(r.item_results))
        return false;
    for (const k of ['revision_before', 'revision_after'])
        if (k in r && r[k] != null && typeof r[k] !== 'string')
            return false;
    if ('failed_index' in r && r.failed_index != null && (typeof r.failed_index !== 'number' || !Number.isInteger(r.failed_index) || r.failed_index < 0))
        return false;
    if ('survivedTotal' in r && (typeof r.survivedTotal !== 'number' || !Number.isInteger(r.survivedTotal) || r.survivedTotal < 0))
        return false;
    for (const k of ['notApplied', 'survived', 'survivedIds'])
        if (k in r && (!r[k] || typeof r[k] !== 'object'))
            return false;
    return true;
}
function validChildResponse(o) {
    const object = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
    const strings = (v, ks) => ks.every(k => !(k in v) || typeof v[k] === 'string');
    if (typeof o.id !== 'string' || typeof o.ok !== 'boolean' || ('unordered' in o && typeof o.unordered !== 'boolean') || ('abandonedIds' in o && o.abandonedIds != null && (!Array.isArray(o.abandonedIds) || !o.abandonedIds.every(x => typeof x === 'string'))))
        return false;
    if (!strings(o, ['id', 'type', 'version', 'windowId', 'staleRisk', 'concurrentWriter']) || ('ok' in o && typeof o.ok !== 'boolean'))
        return false;
    if ('createdAt' in o) {
        if (typeof o.createdAt !== 'string' || !/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$/.test(o.createdAt))
            return false;
        const [y, m, d] = o.createdAt.slice(0, 10).split('-').map(Number);
        const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
        if (d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
            return false;
    }
    for (const k of ['seq', 'seqAbandoned'])
        if (k in o && o[k] != null && (typeof o[k] !== 'number' || !Number.isSafeInteger(o[k]) || o[k] < 0))
            return false;
    if ('result' in o && o.result != null && !object(o.result))
        return false;
    if ('context' in o && o.context != null && !contextShape(o.context))
        return false;
    if ('warnings' in o && o.warnings != null && (!Array.isArray(o.warnings) || !o.warnings.every(x => typeof x === 'string')))
        return false;
    if ('error' in o && o.error != null && (!object(o.error) || !strings(o.error, ['code', 'message', 'detail'])))
        return false;
    if ('artifacts' in o && o.artifacts != null && (!Array.isArray(o.artifacts) || !o.artifacts.every(v => object(v) && strings(v, ['id', 'kind', 'path', 'fileName', 'mimeType', 'sha256', 'inlineBase64']) && (!('size' in v) || (typeof v.size === 'number' && Number.isSafeInteger(v.size) && v.size >= 0)))))
        return false;
    return true;
}
