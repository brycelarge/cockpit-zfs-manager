import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';

import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import CreateSnapshotDialog from './createSnapshotDialog.jsx';
import SnapshotActions from './snapshotActions.jsx';

function PoolSnapshotsTab({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSnapshots();
    }, [pool.name]);

    const loadSnapshots = async () => {
        setLoading(true);
        try {
            const snaps = await ZfsApi.listSnapshots(pool.name);
            setSnapshots(snaps);
        } catch (error) {
            console.error('Failed to load snapshots:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadSnapshots();
        onRefresh();
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading snapshots" />;
    }

    return (
        <>
            <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <Button
                    variant="secondary"
                    onClick={() => Dialogs.show(<CreateSnapshotDialog pool={pool} onRefresh={handleRefresh} />)}
                >
                    Create Snapshot
                </Button>
            </div>
            <ListingTable
                aria-label="Snapshots"
                variant="compact"
                columns={[
                    { title: "Name", header: true, props: { width: 30 } },
                    { title: "Used", props: { width: 20 } },
                    { title: "Referenced", props: { width: 20 } },
                    { title: "Creation", props: { width: 20 } },
                    { title: "", props: { width: 10, "aria-label": "Actions" } },
                ]}
                emptyCaption="No snapshots found"
                rows={snapshots.map(snap => ({
                    columns: [
                        { title: snap.name, header: true },
                        { title: snap.used },
                        { title: snap.referenced },
                        { title: snap.creation },
                        { title: <SnapshotActions snapshot={snap} pool={pool} onRefresh={handleRefresh} /> },
                    ],
                    props: { key: snap.name },
                }))}
            />
        </>
    );
}

export default PoolSnapshotsTab;

