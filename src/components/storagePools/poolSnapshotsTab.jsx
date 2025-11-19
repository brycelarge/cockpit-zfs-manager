import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';
import { MenuToggle } from "@patternfly/react-core/dist/esm/components/MenuToggle";
import { Menu, MenuContent, MenuItem, MenuList } from "@patternfly/react-core/dist/esm/components/Menu";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";

import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import CreateSnapshotDialog from './createSnapshotDialog.jsx';
import SnapshotActions from './snapshotActions.jsx';

function PoolSnapshotsTab({ pool, pools = [], onRefresh }) {
    const Dialogs = useDialogs();
    const [snapshots, setSnapshots] = useState([]);
    const [filesystems, setFilesystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createMenuOpen, setCreateMenuOpen] = useState(false);

    useEffect(() => {
        loadSnapshots();
        loadFileSystems();
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

    const loadFileSystems = async () => {
        try {
            const fs = await ZfsApi.listFileSystems(pool.name);
            setFilesystems(fs);
        } catch (error) {
            console.error('Failed to load file systems:', error);
        }
    };

    const handleRefresh = () => {
        loadSnapshots();
        onRefresh();
    };

    const handleLocalRefresh = () => {
        loadSnapshots();
    };

    const handleCreateSnapshot = (filesystem = null) => {
        setCreateMenuOpen(false);
        Dialogs.show(<CreateSnapshotDialog pool={pool} filesystem={filesystem} onRefresh={handleRefresh} />);
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading snapshots" />;
    }

    const createMenuItems = [
        <MenuItem
            key="pool-snapshot"
            onClick={() => handleCreateSnapshot(null)}
        >
            Create Pool Snapshot ({pool.name})
        </MenuItem>,
        ...(filesystems.length > 0 ? [
            <Divider key="divider" />,
            ...filesystems.map(fs => (
                <MenuItem
                    key={`fs-snapshot-${fs.name}`}
                    onClick={() => handleCreateSnapshot(fs)}
                >
                    Create Snapshot ({fs.name})
                </MenuItem>
            ))
        ] : [])
    ];

    return (
        <>
            <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <MenuToggle
                    isExpanded={createMenuOpen}
                    onToggle={() => setCreateMenuOpen(!createMenuOpen)}
                    variant="secondary"
                >
                    Create Snapshot
                </MenuToggle>
                {createMenuOpen && (
                    <Menu
                        onSelect={() => setCreateMenuOpen(false)}
                        onOpenChange={(isOpen) => setCreateMenuOpen(isOpen)}
                    >
                        <MenuContent>
                            <MenuList>
                                {createMenuItems}
                            </MenuList>
                        </MenuContent>
                    </Menu>
                )}
            </div>
            <ListingTable
                aria-label="Snapshots"
                variant="compact"
                columns={[
                    { title: "Name", header: true, props: { width: 25 } },
                    { title: "Used", props: { width: 15 } },
                    { title: "Referenced", props: { width: 15 } },
                    { title: "Creation", props: { width: 15 } },
                    { title: "Holds", props: { width: 20 } },
                    { title: "", props: { width: 10, "aria-label": "Actions" } },
                ]}
                emptyCaption="No snapshots found"
                rows={snapshots.map(snap => ({
                    columns: [
                        { title: snap.name, header: true },
                        { title: snap.used },
                        { title: snap.referenced },
                        { title: snap.creation },
                        { 
                            title: snap.holds && snap.holds.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pf-t--global--spacer--xs)' }}>
                                    {snap.holds.map(hold => (
                                        <span
                                            key={hold.tag}
                                            style={{
                                                backgroundColor: 'var(--pf-t--global--palette--blue-50)',
                                                color: 'var(--pf-t--global--palette--blue-700)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: 'var(--pf-t--global--font--size--sm)',
                                                fontWeight: 'bold'
                                            }}
                                            title={`Hold tag: ${hold.tag}${hold.timestamp ? ` (${hold.timestamp})` : ''}`}
                                        >
                                            {hold.tag}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span style={{ color: 'var(--pf-t--global--text--color--muted)' }}>-</span>
                            )
                        },
                        { title: <SnapshotActions snapshot={snap} pool={pool} pools={pools} onRefresh={handleLocalRefresh} /> },
                    ],
                    key: snap.name,
                }))}
            />
        </>
    );
}

export default PoolSnapshotsTab;

