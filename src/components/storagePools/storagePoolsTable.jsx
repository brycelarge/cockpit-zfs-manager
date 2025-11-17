import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Card, CardHeader, CardTitle } from '@patternfly/react-core/dist/esm/components/Card';
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";

import { ListingTable } from 'cockpit-components-table.jsx';
import { WithDialogs } from 'dialogs.jsx';
import CreatePoolDialog from './createPoolDialog.jsx';
import PoolActions from './poolActions.jsx';

function StoragePoolsTable({ pools, loading, onRefresh }) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const handleCreatePool = async (poolData) => {
        // TODO: Implement pool creation
        console.log('Creating pool:', poolData);
        onRefresh();
    };

    const actions = (
        <>
            <Button variant="secondary" onClick={() => setCreateDialogOpen(true)}>
                Create Storage Pool
            </Button>
            <Button variant="secondary" onClick={() => {}}>
                Import Storage Pool
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
        <WithDialogs>
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
                    rows={pools.map(pool => ({
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
                    }))}
                />
            </Card>
            <CreatePoolDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onCreate={handleCreatePool}
            />
        </WithDialogs>
    );
}

export default StoragePoolsTable;

