import React, { useState, useEffect } from 'react';

import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import { ZfsApi } from '../zfsApi/index.js';
import { parseSizeToBytes, formatBytes } from '../utils/size.js';

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
                const sizeBytes = parseSizeToBytes(pool.size);
                const usedBytes = parseSizeToBytes(pool.allocated);
                const freeBytes = parseSizeToBytes(pool.free);

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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--xs)' }}>
                                    <div style={{ width: '120px', height: '16px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                        {parseFloat(stats.usagePercent) > 0 ? (
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${Math.min(Math.max(parseFloat(stats.usagePercent) || 0, 0), 100)}%`,
                                                    backgroundColor: parseFloat(stats.usagePercent) > 90 ? '#c9190b' : parseFloat(stats.usagePercent) > 75 ? '#f0ab00' : '#3e8635',
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
                                    <span style={{ fontSize: 'var(--pf-t--global--font--size--sm)' }}>{stats.usagePercent}%</span>
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
                                <DescriptionListGroup>
                                    <DescriptionListTerm>Maximum Size</DescriptionListTerm>
                                    <DescriptionListDescription>{formatBytes(stats.arcStats.max)}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {stats.arcStats.max > 0 && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>Usage</DescriptionListTerm>
                                    <DescriptionListDescription>
                                        {(() => {
                                            const arcUsagePercent = stats.arcStats.max > 0 
                                                ? ((stats.arcStats.size / stats.arcStats.max) * 100).toFixed(1)
                                                : '0.0';
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--xs)' }}>
                                                    <div style={{ width: '120px', height: '16px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                        {parseFloat(arcUsagePercent) > 0 ? (
                                                            <div
                                                                style={{
                                                                    height: '100%',
                                                                    width: `${Math.min(Math.max(parseFloat(arcUsagePercent) || 0, 0), 100)}%`,
                                                                    backgroundColor: parseFloat(arcUsagePercent) > 90 ? '#c9190b' : parseFloat(arcUsagePercent) > 75 ? '#f0ab00' : '#3e8635',
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
                                                    <span style={{ fontSize: 'var(--pf-t--global--font--size--sm)' }}>{arcUsagePercent}%</span>
                                                </div>
                                            );
                                        })()}
                                    </DescriptionListDescription>
                                </DescriptionListGroup>
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

