import { type NativeAction, unavailable, observed } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { covered } from './v2-batch-actions';
const boards = async () => array(await eda.dmt_Board.getAllBoardsInfo());
const signature = (b: IDMT_BoardItem) => JSON.stringify([b.name, b.schematic?.uuid ?? null, b.pcb?.uuid ?? null]);
export const newPcb: NativeAction = { mode: 'V2_NATIVE', scope: 'PROJECT_TOPOLOGY', validate: declaredReadFields('board.new_pcb'), run: async (c) => {
        const p = c.request.input, before = await boards();
        let schematic = (p.schematicUuid ?? p.schematic) as string | undefined;
        if (!schematic)
            schematic = (await eda.dmt_Board.getCurrentBoardInfo())?.schematic?.uuid ?? before[0]?.schematic?.uuid;
        if (!schematic)
            throw Error('V2_SCHEMATIC_REQUIRED');
        const sch = await eda.dmt_Schematic.getSchematicInfo(schematic);
        if (!sch || sch.uuid !== schematic || sch.parentProjectUuid !== c.request.target_ref.project_uuid)
            throw Error('V2_SCHEMATIC_IDENTITY');
        if (p.force !== true && before.some(b => b.schematic?.uuid === schematic))
            throw Error('V2_SCHEMATIC_ALREADY_BOUND');
        const oldPcbs = new Set(array(await eda.dmt_Pcb.getAllPcbsInfo()).map(x => x.uuid));
        let name: string | undefined, id: string | undefined;
        let compensated = false;
        const shell = async () => { const list = await boards(); const b = list.find(b => b.name === name); if (!name || !b || b.schematic?.uuid !== schematic || before.some(x => x.name === name))
            throw Error('V2_BOARD_IDENTITY'); return b; };
        c.prepare(async () => {
            const all = await boards(), pcbs = array(await eda.dmt_Pcb.getAllPcbsInfo());
            if (pcbs.some(x => !oldPcbs.has(x.uuid) && x.uuid !== id))
                return { changed: null, verification: unavailable() };
            if (!name || before.some(x => x.name === name))
                return { changed: null, verification: unavailable() };
            const b = all.find(x => x.name === name);
            const unchanged = before.filter(x => x.schematic?.uuid !== schematic).every(x => all.some(y => signature(x) === signature(y)));
            const donors = before.filter(x => x.schematic?.uuid === schematic);
            if (donors.some(x => { const y = all.find(y => y.name === x.name); return !y || y.pcb?.uuid !== x.pcb?.uuid || y.schematic?.uuid && y.schematic.uuid !== schematic; }))
                return { changed: null, verification: unavailable() };
            if (!unchanged || all.some(x => !before.some(y => x.name === y.name) && x.name !== name))
                return { changed: null, verification: unavailable() };
            if (compensated && !b) {
                const same = all.length === before.length && before.every(x => all.some(y => signature(x) === signature(y)));
                return same ? covered({ boardName: name, schematicUuid: schematic, rollback: true }, 2, 0, false, ['fresh_compensation_inventory']) : { changed: null, verification: unavailable() };
            }
            if (!b || b.schematic?.uuid !== schematic)
                return { changed: null, verification: unavailable() };
            const pcb = pcbs.find(x => x.uuid === id);
            const complete = !!id && !oldPcbs.has(id) && b.pcb?.uuid === id && pcb?.parentProjectUuid === c.request.target_ref.project_uuid;
            if (!complete && b.pcb?.uuid)
                return { changed: null, verification: unavailable() };
            return covered({ boardName: name, pcbName: pcb?.name, pcbUuid: id, schematicUuid: schematic }, 2, complete ? 2 : 1, true, ['fresh_board_schematic_binding', 'fresh_created_pcb_identity', 'unrelated_topology_inventory']);
        });
        await c.effect(async () => { if (JSON.stringify(await boards()) !== JSON.stringify(before))
            throw Error('V2_BOARD_DRIFT'); name = await eda.dmt_Board.createBoard(schematic); });
        await shell();
        try {
            await c.effect(async () => { const b = await shell(); if (b.pcb?.uuid)
                throw Error('V2_UNEXPECTED_PCB'); id = await eda.dmt_Pcb.createPcb(name!); });
        }
        catch (e) {
            const pcbs = array(await eda.dmt_Pcb.getAllPcbsInfo());
            const b = await shell();
            if (!b.pcb?.uuid && pcbs.every(x => oldPcbs.has(x.uuid)))
                try {
                    await c.effect(async () => { await shell(); await eda.dmt_Board.deleteBoard(name!); compensated = true; });
                }
                catch { /* reconcile retained scope */ }
            throw e;
        }
        if (!id)
            return c.verify();
        if (typeof p.name === 'string' && p.name && p.name !== name) {
            try {
                await c.effect(async () => { const b = await shell(); if (b.pcb?.uuid !== id)
                    throw Error('V2_BOARD_DRIFT'); const accepted = await eda.dmt_Board.modifyBoardName(name!, p.name as string); if (accepted)
                    name = p.name as string; });
            }
            catch { /* optional baseline rename remains best effort; verifier checks exact binding */ }
        }
        return c.verify();
    } };
export const rebindBoard: NativeAction = { mode: 'V2_NATIVE', scope: 'PROJECT_TOPOLOGY', validate: declaredReadFields('board.rebind'), run: async (c) => {
        const p = c.request.input, schematic = p.schematicUuid as string, pcb = p.pcbUuid as string | undefined;
        const before = await boards();
        if (new Set(before.map(x => x.name)).size !== before.length)
            throw Error('V2_AMBIGUOUS_BOARD');
        const target = p.name ? before.find(b => b.name === p.name) : await eda.dmt_Board.getCurrentBoardInfo();
        if (target && !before.some(x => signature(x) === signature(target)))
            throw Error('V2_BOARD_IDENTITY');
        const sch = await eda.dmt_Schematic.getSchematicInfo(schematic);
        if (sch?.uuid !== schematic || sch.parentProjectUuid !== c.request.target_ref.project_uuid)
            throw Error('V2_SCHEMATIC_IDENTITY');
        if (pcb) {
            const info = await eda.dmt_Pcb.getPcbInfo(pcb);
            if (info?.uuid !== pcb || info.parentProjectUuid !== c.request.target_ref.project_uuid)
                throw Error('V2_PCB_IDENTITY');
        }
        const donor = before.find(b => b.schematic?.uuid === schematic && b.name !== target?.name);
        if (donor && p.force !== true)
            throw Error('V2_SCHEMATIC_ALREADY_BOUND');
        const oldName = target?.name, wantName = (p.name as string | undefined) ?? oldName;
        let createdName: string | undefined, createAttempted = false, restored = false, recoveryName: string | undefined;
        const oldValue = target ? { name: oldName, schematicUuid: target.schematic?.uuid ?? null, pcbUuid: target.pcb?.uuid ?? null } : null;
        if (target && target.schematic?.uuid === schematic && target.pcb?.uuid === pcb)
            return observed({ boardName: oldName, schematicUuid: schematic, pcbUuid: pcb ?? null, replaced: oldValue }, ['fresh_exact_board_binding'], false);
        c.prepare(async () => {
            const after = await boards();
            if (createAttempted && !createdName && !recoveryName)
                return { changed: null, verification: unavailable() };
            if (new Set(after.map(b => b.name)).size !== after.length || after.some(b => !before.some(x => x.name === b.name) && b.name !== createdName && b.name !== recoveryName))
                return { changed: null, verification: unavailable() };
            const other = before.filter(b => b.name !== oldName && b.name !== donor?.name);
            if (!other.every(b => after.some(x => signature(x) === signature(b))))
                return { changed: null, verification: unavailable() };
            if (donor) {
                const d = after.find(b => b.name === donor.name);
                if (!d || d.pcb?.uuid !== donor.pcb?.uuid || d.schematic?.uuid && d.schematic.uuid !== schematic)
                    return { changed: null, verification: unavailable() };
            }
            const current = createdName ? after.find(b => b.name === createdName) : undefined;
            const satisfied = !!current && current.schematic?.uuid === schematic && current.pcb?.uuid === pcb && (!oldName || oldName === createdName || !after.some(b => b.name === oldName)) && (!donor || !after.find(b => b.name === donor.name)?.schematic?.uuid);
            const unchanged = before.length === after.length && before.every(b => after.some(x => signature(x) === signature(b)));
            return covered({ boardName: createdName, schematicUuid: schematic, pcbUuid: pcb ?? null, replaced: oldValue, rollback: restored }, 1, Number(satisfied), !unchanged, ['fresh_complete_board_binding_inventory', 'old_binding_absence', 'unrelated_topology_preserved']);
        });
        if (oldName)
            await c.effect(async () => { const fresh = await boards(); if (!fresh.some(x => signature(x) === signature(target!)))
                throw Error('V2_BOARD_DRIFT'); await eda.dmt_Board.deleteBoard(oldName); });
        try {
            await c.effect(async () => { if (oldName && (await boards()).some(x => x.name === oldName))
                throw Error('V2_OLD_BOARD_SURVIVED'); createAttempted = true; createdName = await eda.dmt_Board.createBoard(schematic, pcb); });
            if (!createdName)
                throw Error('V2_CREATE_ID_UNAVAILABLE');
        }
        catch (error) {
            // Compensation is a distinct old-binding restoration, never replay of the
            // requested create. Admit it only after fresh, complete no-new-board proof.
            const after = await boards();
            const noNew = after.every(x => before.some(y => signature(x) === signature(y))) && before.filter(x => x.name !== oldName).every(x => after.some(y => signature(x) === signature(y)));
            if (target && oldName && !after.some(x => x.name === oldName) && noNew)
                try {
                    await c.effect(async () => { restored = true; recoveryName = await eda.dmt_Board.createBoard(target.schematic?.uuid, target.pcb?.uuid); });
                    if (recoveryName && recoveryName !== oldName)
                        await c.effect(async () => { const b = (await boards()).find(x => x.name === recoveryName); if (!b || b.schematic?.uuid !== target.schematic?.uuid || b.pcb?.uuid !== target.pcb?.uuid)
                            throw Error('V2_RECOVERY_BINDING'); if (await eda.dmt_Board.modifyBoardName(recoveryName!, oldName))
                            recoveryName = oldName; });
                }
                catch { /* deadline or incomplete compensation remains owned for readback */ }
            throw error;
        }
        if (!createdName)
            return c.verify();
        if (wantName && wantName !== createdName)
            try {
                await c.effect(async () => { const current = (await boards()).find(b => b.name === createdName); if (!current || current.schematic?.uuid !== schematic || current.pcb?.uuid !== pcb)
                    throw Error('V2_BOARD_DRIFT'); if (await eda.dmt_Board.modifyBoardName(createdName!, wantName))
                    createdName = wantName; });
            }
            catch { /* optional baseline rename */ }
        return c.verify();
    } };
