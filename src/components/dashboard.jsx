import React, { useState, useEffect } from 'react';

import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import { ZfsApi } from '../zfsApi/index.js';

function Dashboard({ pools, loading }) {
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        if (!loading && pools.length > 0) {
            loadStats();
        } else if (!loading) {
            setLoadingStats(false);
        }
    }, [pools, loading]);

    const loadStats = async () => {
        setLoadingStats(true);
        try {
            let totalSize = 0;
            let totalUsed = 0;
            let totalFree = 0;
            let healthyPools = 0;
            let degradedPools = 0;
            let faultedPools = 0;
            let totalFilesystems = 0;
            let totalSnapshots = 0;

            for (const pool of pools) {
                // Parse size (e.g., "7.27T" -> bytes)
                const sizeBytes = parseSize(pool.size);
                const usedBytes = parseSize(pool.allocated);
                const freeBytes = parseSize(pool.free);

                totalSize += sizeBytes;
                totalUsed += usedBytes;
                totalFree += freeBytes;

                if (pool.health === 'ONLINE') {
                    healthyPools++;
                } else if (pool.health === 'DEGRADED') {
                    degradedPools++;
                } else if (pool.health === 'FAULTED' || pool.health === 'UNAVAIL') {
                    faultedPools++;
                }

                try {
                    const filesystems = await ZfsApi.listFileSystems(pool.name);
                    totalFilesystems += filesystems.length;

                    const snapshots = await ZfsApi.listSnapshots(pool.name);
                    totalSnapshots += snapshots.length;
                } catch {
                    // Ignore errors
                }
            }

            // Get ZFS ARC memory stats
            let arcStats = null;
            try {
                arcStats = await ZfsApi.getArcStats();
            } catch (error) {
                console.error('Failed to load ARC stats:', error);
            }

            setStats({
                totalPools: pools.length,
                healthyPools,
                degradedPools,
                faultedPools,
                totalSize,
                totalUsed,
                totalFree,
                totalFilesystems,
                totalSnapshots,
                usagePercent: totalSize > 0 ? ((totalUsed / totalSize) * 100).toFixed(1) : 0,
                arcStats
            });
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const parseSize = (sizeStr) => {
        if (!sizeStr) return 0;
        const match = sizeStr.match(/^([\d.]+)([KMGT]?)$/);
        if (!match) return 0;
        const value = parseFloat(match[1]);
        const unit = match[2];
        const multipliers = { '': 1, 'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3, 'T': 1024 ** 4 };
        return value * (multipliers[unit] || 1);
    };

    const formatBytes = (bytes) => {
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    };

    if (loading || loadingStats) {
        return <Spinner size="lg" aria-label="Loading dashboard" />;
    }

    if (pools.length === 0) {
        return (
            <Alert variant="info" title="No storage pools">
                Create a storage pool to get started with ZFS management.
            </Alert>
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--pf-t--global--spacer--md)' }}>
            <Card>
                <CardTitle>Storage Pools</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Total Pools</DescriptionListTerm>
                            <DescriptionListDescription>{stats.totalPools}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Healthy</DescriptionListTerm>
                            <DescriptionListDescription>
                                <span style={{ color: '#3e8635', fontWeight: 'bold' }}>{stats.healthyPools}</span>
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                        {stats.degradedPools > 0 && (
                            <DescriptionListGroup>
                                <DescriptionListTerm>Degraded</DescriptionListTerm>
                                <DescriptionListDescription>
                                    <span style={{ color: '#f0ab00', fontWeight: 'bold' }}>{stats.degradedPools}</span>
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        )}
                        {stats.faultedPools > 0 && (
                            <DescriptionListGroup>
                                <DescriptionListTerm>Faulted</DescriptionListTerm>
                                <DescriptionListDescription>
                                    <span style={{ color: '#c9190b', fontWeight: 'bold' }}>{stats.faultedPools}</span>
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        )}
                    </DescriptionList>
                </CardBody>
            </Card>

            <Card>
                <CardTitle>Storage Capacity</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Total Capacity</DescriptionListTerm>
                            <DescriptionListDescription>{formatBytes(stats.totalSize)}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Used</DescriptionListTerm>
                            <DescriptionListDescription>{formatBytes(stats.totalUsed)}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Available</DescriptionListTerm>
                            <DescriptionListDescription>{formatBytes(stats.totalFree)}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Usage</DescriptionListTerm>
                            <DescriptionListDescription>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--sm)' }}>
                                    <div style={{ flex: 1, height: '20px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${stats.usagePercent}%`,
                                                backgroundColor: parseFloat(stats.usagePercent) > 80 ? '#c9190b' : parseFloat(stats.usagePercent) > 60 ? '#f0ab00' : '#3e8635',
                                                transition: 'width 0.3s ease'
                                            }}
                                        />
                                    </div>
                                    <span>{stats.usagePercent}%</span>
                                </div>
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    </DescriptionList>
                </CardBody>
            </Card>

            <Card>
                <CardTitle>Resources</CardTitle>
                <CardBody>
                    <DescriptionList isHorizontal>
                        <DescriptionListGroup>
                            <DescriptionListTerm>File Systems</DescriptionListTerm>
                            <DescriptionListDescription>{stats.totalFilesystems}</DescriptionListDescription>
                        </DescriptionListGroup>
                        <DescriptionListGroup>
                            <DescriptionListTerm>Snapshots</DescriptionListTerm>
                            <DescriptionListDescription>{stats.totalSnapshots}</DescriptionListDescription>
                        </DescriptionListGroup>
                    </DescriptionList>
                </CardBody>
            </Card>

            {stats.arcStats && stats.arcStats.available && (
                <Card>
                    <CardTitle>ZFS ARC Memory</CardTitle>
                    <CardBody>
                        <DescriptionList isHorizontal>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Current Size</DescriptionListTerm>
                                <DescriptionListDescription>{formatBytes(stats.arcStats.size)}</DescriptionListDescription>
                            </DescriptionListGroup>
                            {stats.arcStats.max > 0 && (
                                <>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>Maximum Size</DescriptionListTerm>
                                        <DescriptionListDescription>{formatBytes(stats.arcStats.max)}</DescriptionListDescription>
                                    </DescriptionListGroup>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>Usage</DescriptionListTerm>
                                        <DescriptionListDescription>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--sm)' }}>
                                                <div style={{ flex: 1, height: '20px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: `${Math.min((stats.arcStats.size / stats.arcStats.max) * 100, 100).toFixed(1)}%`,
                                                            backgroundColor: (stats.arcStats.size / stats.arcStats.max) > 0.9 ? '#c9190b' : (stats.arcStats.size / stats.arcStats.max) > 0.7 ? '#f0ab00' : '#3e8635',
                                                            transition: 'width 0.3s ease'
                                                        }}
                                                    />
                                                </div>
                                                <span>{((stats.arcStats.size / stats.arcStats.max) * 100).toFixed(1)}%</span>
                                            </div>
                                        </DescriptionListDescription>
                                    </DescriptionListGroup>
                                </>
                            )}
                            {stats.arcStats.metadata > 0 && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>Metadata Cache</DescriptionListTerm>
                                    <DescriptionListDescription>{formatBytes(stats.arcStats.metadata)}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                        </DescriptionList>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}

export default Dashboard;

