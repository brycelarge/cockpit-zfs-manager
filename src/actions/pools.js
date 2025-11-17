import { ZfsApi } from '../zfsApi/index.js';

export async function loadPools() {
    return ZfsApi.listPools();
}

