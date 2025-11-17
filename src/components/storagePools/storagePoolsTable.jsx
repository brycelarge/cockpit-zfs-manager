import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Card, CardHeader, CardTitle } from '@patternfly/react-core/dist/esm/components/Card';
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";

import { ListingTable } from 'cockpit-components-table.jsx';
import { ListingPanel } from 'cockpit-components-listing-panel.jsx';
import { WithDialogs, useDialogs } from 'dialogs.jsx';
import CreatePoolDialog from './createPoolDialog.jsx';
import ImportPoolDialog from './importPoolDialog.jsx';
import PoolActions from './poolActions.jsx';
import PoolFileSystemsTab from './poolFileSystemsTab.jsx';
import PoolSnapshotsTab from './poolSnapshotsTab.jsx';
import PoolStatusTab from './poolStatusTab.jsx';
import PerformanceStatsTab from './performanceStatsTab.jsx';
import SanoidTab from './sanoidTab.jsx';
import ScrubTab from './scrubTab.jsx';
import UnlockFileSystemsDialog from './unlockFileSystemsDialog.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function StoragePoolsTableContent({ pools, loading, onRefresh }) {
    const Dialogs = useDialogs();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const handleCreatePool = async (poolData) => {
        await ZfsApi.createPool(poolData.name, poolData.devices, poolData.vdevType, poolData.force || false);
        setCreateDialogOpen(false);
        onRefresh();
    };

    const handleImportPool = () => {
        Dialogs.show(<ImportPoolDialog pools={pools} onRefresh={onRefresh} />);
    };

    const handleUnlockFileSystems = () => {
        Dialogs.show(<UnlockFileSystemsDialog pools={pools} onRefresh={onRefresh} />);
    };

    const actions = (
        <>
            <Button variant="secondary" onClick={() => setCreateDialogOpen(true)}>
                Create Storage Pool
            </Button>
            <Button variant="secondary" onClick={handleImportPool}>
                Import Storage Pool
            </Button>
            <Button variant="secondary" onClick={handleUnlockFileSystems}>
                Unlock File Systems
            </Button>
            <Button variant="secondary" onClick={onRefresh}>
                Refresh
            </Button>
        </>
    );

    if (loading) {
        return (
            <Card isPlain>
                <CardHeader>
                    <CardTitle component="h2">Storage Pools</CardTitle>
                </CardHeader>
                <Spinner size="xl" aria-label="Loading pools" />
            </Card>
        );
    }

    return (
        <>
            <Card isPlain>
                <CardHeader actions={{ actions }}>
                    <CardTitle component="h2">Storage Pools</CardTitle>
                </CardHeader>
                <ListingTable
                    aria-label="Storage pools"
                    variant="compact"
                    columns={[
                        { title: "Name", header: true, props: { width: 15 } },
                        { title: "Health", props: { width: 15 } },
                        { title: "Size", props: { width: 15 } },
                        { title: "Allocated", props: { width: 15 } },
                        { title: "Free", props: { width: 15 } },
                        { title: "Fragmentation", props: { width: 15 } },
                        { title: "Usage", props: { width: 20 } },
                        { title: "", props: { width: 15, "aria-label": "Actions" } },
                    ]}
                    emptyCaption="No storage pool is defined on this host"
                    rows={pools.map(pool => {
                        const tabRenderers = [
                            {
                                name: "File Systems",
                                renderer: PoolFileSystemsTab,
                                data: { pool, onRefresh },
                                id: `${pool.name}-filesystems`
                            },
                            {
                                name: "Snapshots",
                                renderer: PoolSnapshotsTab,
                                data: { pool, onRefresh },
                                id: `${pool.name}-snapshots`
                            },
                            {
                                name: "Status",
                                renderer: PoolStatusTab,
                                data: { pool },
                                id: `${pool.name}-status`
                            },
                            {
                                name: "Performance",
                                renderer: PerformanceStatsTab,
                                data: { pool },
                                id: `${pool.name}-performance`
                            },
                            {
                                name: "Sanoid",
                                renderer: SanoidTab,
                                data: { pool },
                                id: `${pool.name}-sanoid`
                            },
                            {
                                name: "Scrub",
                                renderer: ScrubTab,
                                data: { pool },
                                id: `${pool.name}-scrub`
                            }
                        ];

                        return {
                            columns: [
                                { title: pool.name, header: true },
                                { title: pool.health },
                                { title: pool.size },
                                { title: pool.allocated },
                                { title: pool.free },
                                { title: pool.fragmentation },
                                { title: "Usage" },
                                { title: <PoolActions pool={pool} onRefresh={onRefresh} /> },
                            ],
                            props: { key: pool.name },
                            expandedContent: <ListingPanel tabRenderers={tabRenderers} />
                        };
                    })}
                />
            </Card>
            <CreatePoolDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onCreate={handleCreatePool}
            />
        </>
    );
}

function StoragePoolsTable({ pools, loading, onRefresh }) {
    return (
        <WithDialogs>
            <StoragePoolsTableContent pools={pools} loading={loading} onRefresh={onRefresh} />
        </WithDialogs>
    );
}

export default StoragePoolsTable;

