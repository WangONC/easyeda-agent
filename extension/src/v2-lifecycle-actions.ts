import { observed, unavailable, type NativeAction, type NativeContext } from './execution-v2';
import { array, declaredReadFields } from './v2-native-actions';
import { settleSchematic } from './lifecycle-settle';
const initializing = new Set<string>();
const settle = (project: string, id?: string) => settleSchematic({ current: async () => (await eda.dmt_Project.getCurrentProjectInfo())?.uuid ?? '', inventory: () => eda.dmt_Schematic.getAllSchematicsInfo(), wait: ms => new Promise(r => setTimeout(r, ms)) }, project, id);
async function source(c: NativeContext) { const current = await eda.dmt_Project.getCurrentProjectInfo(); if (c.request.input.expected_project_uuid !== (current?.uuid ?? ''))
    throw Error('V2_TARGET_MISMATCH'); }
function transaction(c: NativeContext) { if (c.request.input.session_token !== c.request.target_ref.activation)
    throw Error('V2_SESSION_LOST'); if (c.request.input.client_transaction_id !== c.request.operation_id)
    throw Error('V2_TRANSACTION_ID_MISMATCH'); }
export const projectCreate: NativeAction = { mode: 'V2_NATIVE', scope: 'PROJECT_TOPOLOGY', validate: declaredReadFields('project.create'), run: async (c) => {
        transaction(c);
        await source(c);
        const p = c.request.input;
        let id: string | undefined;
        c.prepare(async () => { if (!id)
            return { changed: null, verification: unavailable() }; const info = await eda.dmt_Project.getProjectInfo(id); if (!info || info.uuid !== id || info.friendlyName !== p.name)
            return { changed: null, verification: unavailable() }; return observed({ project_uuid: id, project: info, session_token: c.request.target_ref.activation, client_transaction_id: p.client_transaction_id, opened: false }, ['native_created_uuid', 'fresh_project_identity_name'], true); });
        await c.effect(async () => { await source(c); id = await eda.dmt_Project.createProject(p.name as string, undefined, p.team_uuid as string | undefined, p.folder_uuid as string | undefined); if (id)
            initializing.add(id); });
        return c.verify();
    } };
export const projectOpen: NativeAction = { mode: 'V2_NATIVE', scope: 'NAVIGATION_SELECTION', validate: p => { declaredReadFields('project.open')(p); if (p.saved_current_project !== true)
        throw Error('UNSAVED_PROJECT_RISK'); }, run: async (c) => {
        await source(c);
        const id = c.request.input.project_uuid as string;
        const info = await eda.dmt_Project.getProjectInfo(id);
        if (!info || info.uuid !== id)
            throw Error('V2_PROJECT_NOT_FOUND');
        c.navigationTarget({ scope: 'PROJECT', session: c.request.target_ref.session, activation: c.request.target_ref.activation, project_uuid: id });
        let accepted = false;
        const before = c.request.input.expected_project_uuid;
        c.prepare(async () => {
            const current = await eda.dmt_Project.getCurrentProjectInfo();
            if (current?.uuid !== id)
                return { changed: current?.uuid === before ? false : null, verification: unavailable() };
            let initial;
            if (initializing.has(id)) {
                initial = await settle(id);
                if (!initial)
                    return { changed: null, verification: unavailable() };
                initializing.delete(id);
            }
            return observed({ opened: accepted || before === id, project_uuid: id, expected_project_uuid: id, initial_schematic: initial, initial_schematic_state: initial ? 'verified' : 'not_requested' }, ['fresh_project_uuid', ...(initial ? ['initial_schematic_settled'] : [])], before !== id);
        });
        if (before !== id)
            await c.effect(async () => { await source(c); accepted = await eda.dmt_Project.openProject(id); });
        return c.verify();
    } };
export const schematicCreate: NativeAction = { mode: 'V2_NATIVE', scope: 'PROJECT_TOPOLOGY', validate: declaredReadFields('schematic.create'), run: async (c) => {
        transaction(c);
        await source(c);
        const p = c.request.input, project = c.request.target_ref.project_uuid!;
        let board: Awaited<ReturnType<typeof eda.dmt_Board.getBoardInfo>>;
        if (p.board_name !== undefined) {
            board = await eda.dmt_Board.getBoardInfo(p.board_name as string);
            if (!board)
                throw Error('V2_BOARD_NOT_FOUND');
        }
        if (p.board_name === undefined) {
            const existing = await settle(project);
            if (existing)
                return observed({ reused: true, schematic_uuid: existing.uuid, project_uuid: project, pages: existing.page ?? [], opened: false }, ['settled_existing_schematic'], false);
            if (initializing.has(project))
                throw Error('HOST_INITIALIZATION_UNRESOLVED');
            const tree = await eda.dmt_Project.getCurrentProjectInfo();
            if (tree?.uuid !== project || !Array.isArray(tree.data) || tree.data.length)
                throw Error('SCHEMATIC_ABSENCE_UNPROVEN');
        }
        const before = new Set(array(await eda.dmt_Schematic.getAllSchematicsInfo()).map(x => x.uuid));
        let id: string | undefined;
        c.prepare(async () => { if (!id || before.has(id))
            return { changed: null, verification: unavailable() }; let info = await eda.dmt_Schematic.getSchematicInfo(id); if (info?.uuid !== id || info.parentProjectUuid !== project)
            info = await settle(project, id) as IDMT_SchematicItem | undefined; if (!info || info.uuid !== id || info.parentProjectUuid !== project || !Array.isArray(info.page))
            return { changed: null, verification: unavailable() }; return observed({ reused: false, schematic_uuid: id, project_uuid: project, pages: info.page, opened: false, client_transaction_id: p.client_transaction_id }, ['native_created_schematic_uuid', 'fresh_parent_project', 'fresh_pages'], true); });
        await c.effect(async () => { await source(c); if (board && JSON.stringify(await eda.dmt_Board.getBoardInfo(p.board_name as string)) !== JSON.stringify(board))
            throw Error('V2_BOARD_DRIFT'); id = await eda.dmt_Schematic.createSchematic(p.board_name as string | undefined); });
        return c.verify();
    } };
