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
import DisksTab from './disksTab.jsx';
import PoolZvolsTab from './poolZvolsTab.jsx';
import UnlockFileSystemsDialog from './unlockFileSystemsDialog.jsx';
import UpgradeAllPoolsDialog from './upgradeAllPoolsDialog.jsx';
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

    const handleUpgradeAllPools = () => {
        Dialogs.show(<UpgradeAllPoolsDialog pools={pools} onRefresh={onRefresh} />);
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
            <Button variant="secondary" onClick={handleUpgradeAllPools}>
                Upgrade All Pools
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
                        { title: "Name", header: true, props: { width: 12 } },
                        { title: "RAID Type", props: { width: 12 } },
                        { title: "Health", props: { width: 12 } },
                        { title: "Size", props: { width: 12 } },
                        { title: "Allocated", props: { width: 12 } },
                        { title: "Free", props: { width: 12 } },
                        { title: "Fragmentation", props: { width: 12 } },
                        { title: "Usage", props: { width: 16 } },
                        { title: "", props: { width: 12, "aria-label": "Actions" } },
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
                                name: "ZVOLs",
                                renderer: PoolZvolsTab,
                                data: { pool, onRefresh },
                                id: `${pool.name}-zvols`
                            },
                            {
                                name: "Snapshots",
                                renderer: PoolSnapshotsTab,
                                data: { pool, pools, onRefresh },
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
                            },
                            {
                                name: "Disks",
                                renderer: DisksTab,
                                data: { pool },
                                id: `${pool.name}-disks`
                            }
                        ];

                        // Calculate usage percentage for pool
                        const parseSize = (sizeStr) => {
                            if (!sizeStr || sizeStr === '-') return 0;
                            // Handle formats like "4.8T", "218.6G", "4.8 TiB", "218.6 GiB", etc.
                            const match = sizeStr.match(/^([\d.]+)\s*([KMGT]i?B?)$/i);
                            if (!match) {
                                // Try without unit (just number)
                                const numMatch = sizeStr.match(/^([\d.]+)$/);
                                if (numMatch) return parseFloat(numMatch[1]);
                                return 0;
                            }
                            const value = parseFloat(match[1]);
                            const unit = match[2].toUpperCase().replace(/I?B?$/, ''); // Remove 'iB' or 'B', keep just K/M/G/T
                            const multipliers = { '': 1, 'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3, 'T': 1024 ** 4 };
                            return value * (multipliers[unit] || 1);
                        };

                        const poolSizeBytes = parseSize(pool.size);
                        const poolAllocatedBytes = parseSize(pool.allocated);
                        const poolUsagePercent = poolSizeBytes > 0 ? ((poolAllocatedBytes / poolSizeBytes) * 100).toFixed(1) : '0.0';

                        // Format vdev type for display
                        const formatVdevType = (type) => {
                            const types = {
                                'stripe': 'Stripe',
                                'mirror': 'Mirror',
                                'raidz': 'RAID-Z',
                                'raidz2': 'RAID-Z2',
                                'raidz3': 'RAID-Z3',
                                'Unknown': 'Unknown'
                            };
                            return types[type] || type || 'Stripe';
                        };

                        // Format health with color
                        const formatHealth = (health) => {
                            if (!health) return health;
                            
                            const healthUpper = health.toUpperCase();
                            let color = undefined; // Default - use theme color
                            
                            if (healthUpper === 'ONLINE') {
                                color = '#3e8635'; // PatternFly success green
                            } else if (healthUpper === 'DEGRADED' || healthUpper === 'FAULTED') {
                                color = '#c9190b'; // PatternFly danger red
                            } else if (healthUpper === 'OFFLINE' || healthUpper === 'UNAVAIL') {
                                color = '#f0ab00'; // PatternFly warning orange
                            }
                            
                            const style = color ? { 
                                color: color,
                                fontWeight: 'bold',
                                fontSize: 'var(--pf-t--global--font--size--md)'
                            } : {
                                fontWeight: 'bold',
                                fontSize: 'var(--pf-t--global--font--size--md)'
                            };
                            
                            return (
                                <span style={style}>
                                    {health}
                                </span>
                            );
                        };

                        return {
                            columns: [
                                { title: pool.name, header: true },
                                { title: formatVdevType(pool.vdevType) },
                                { title: formatHealth(pool.health) },
                                { title: pool.size },
                                { title: pool.allocated },
                                { title: pool.free },
                                { title: pool.fragmentation },
                                {
                                    title: (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--xs)' }}>
                                            <div style={{ width: '80px', height: '16px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                {parseFloat(poolUsagePercent) > 0 ? (
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: `${Math.min(Math.max(parseFloat(poolUsagePercent) || 0, 0), 100)}%`,
                                                            backgroundColor: parseFloat(poolUsagePercent) > 90 ? '#c9190b' : parseFloat(poolUsagePercent) > 75 ? '#f0ab00' : '#3e8635',
                                                            transition: 'width 0.3s ease',
                                                            minWidth: '2px'
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: '2px',
                                                            backgroundColor: '#3e8635',
                                                            opacity: 0.3
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <span style={{ fontSize: 'var(--pf-t--global--font--size--sm)' }}>{poolUsagePercent}%</span>
                                        </div>
                                    )
                                },
                                { title: <PoolActions pool={pool} onRefresh={onRefresh} /> },
                            ],
                            key: pool.name,
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

