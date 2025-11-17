import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import CreateFileSystemDialog from './createFileSystemDialog.jsx';
import FileSystemActions from './fileSystemActions.jsx';

function PoolFileSystemsTab({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [filesystems, setFilesystems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFileSystems();
    }, [pool.name]);

    const loadFileSystems = async () => {
        setLoading(true);
        try {
            const fs = await ZfsApi.listFileSystems(pool.name);
            setFilesystems(fs);
        } catch (error) {
            console.error('Failed to load file systems:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadFileSystems();
        onRefresh();
    };

    const parseSize = (sizeStr) => {
        if (!sizeStr || sizeStr === '-') return 0;
        const match = sizeStr.match(/^([\d.]+)([KMGT]?)$/);
        if (!match) return 0;
        const value = parseFloat(match[1]);
        const unit = match[2];
        const multipliers = { '': 1, 'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3, 'T': 1024 ** 4 };
        return value * (multipliers[unit] || 1);
    };

    const calculateUsagePercent = (used, quota, available) => {
        // If quota is set, calculate usage based on quota
        if (quota && quota !== '-') {
            const usedBytes = parseSize(used);
            const quotaBytes = parseSize(quota);
            if (quotaBytes === 0) return null;
            return ((usedBytes / quotaBytes) * 100).toFixed(1);
        }
        // Otherwise, calculate usage based on used / (used + available)
        if (available && available !== '-') {
            const usedBytes = parseSize(used);
            const availableBytes = parseSize(available);
            const totalBytes = usedBytes + availableBytes;
            if (totalBytes === 0) return null;
            return ((usedBytes / totalBytes) * 100).toFixed(1);
        }
        return null;
    };

    const formatCompressionRatio = (ratio) => {
        if (!ratio || ratio === '-' || ratio === '1.00x' || ratio === '1.0x') return null;
        return ratio;
    };

    const formatDedupRatio = (ratio) => {
        if (!ratio || ratio === '-' || ratio === '1.00x' || ratio === '1.0x') return null;
        return ratio;
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading file systems" />;
    }

    return (
        <>
            <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <Button
                    variant="secondary"
                    onClick={() => Dialogs.show(<CreateFileSystemDialog pool={pool} onRefresh={handleRefresh} />)}
                >
                    Create File System
                </Button>
            </div>
            <ListingTable
                aria-label="File systems"
                variant="compact"
                columns={[
                    { title: "Name", header: true, props: { width: 20 } },
                    { title: "Used", props: { width: 10 } },
                    { title: "Available", props: { width: 10 } },
                    { title: "Quota", props: { width: 10 } },
                    { title: "Usage", props: { width: 10 } },
                    { title: "Compression", props: { width: 10 } },
                    { title: "Deduplication", props: { width: 10 } },
                    { title: "Mountpoint", props: { width: 12 } },
                    { title: "", props: { width: 8, "aria-label": "Actions" } },
                ]}
                emptyCaption="No file systems found"
                rows={filesystems.map(fs => {
                    const usagePercent = calculateUsagePercent(fs.used, fs.quota, fs.available);
                    const compressionRatio = formatCompressionRatio(fs.compressratio);
                    const dedupRatio = formatDedupRatio(fs.dedupratio);

                    return {
                        columns: [
                            { title: fs.name, header: true },
                            { title: fs.used },
                            { title: fs.available },
                            { title: fs.quota || '-' },
                            {
                                title: usagePercent ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--xs)' }}>
                                        <div style={{ width: '60px', height: '16px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${Math.min(usagePercent, 100)}%`,
                                                    backgroundColor: parseFloat(usagePercent) > 90 ? '#c9190b' : parseFloat(usagePercent) > 75 ? '#f0ab00' : '#3e8635',
                                                    transition: 'width 0.3s ease'
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: 'var(--pf-t--global--font--size--sm)' }}>{usagePercent}%</span>
                                    </div>
                                ) : '-',
                            },
                            {
                                title: compressionRatio ? (
                                    <span style={{ color: '#3e8635' }}>{compressionRatio}</span>
                                ) : '-'
                            },
                            {
                                title: dedupRatio ? (
                                    <span style={{ color: '#3e8635' }}>{dedupRatio}</span>
                                ) : '-'
                            },
                            { title: fs.mountpoint || '-' },
                            { title: <FileSystemActions filesystem={fs} pool={pool} onRefresh={handleRefresh} /> },
                        ],
                        key: fs.name,
                        expandedContent: (
                            <div style={{ padding: 'var(--pf-t--global--spacer--md)' }}>
                                <DescriptionList isHorizontal>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>Name</DescriptionListTerm>
                                        <DescriptionListDescription>{fs.name}</DescriptionListDescription>
                                    </DescriptionListGroup>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>Used</DescriptionListTerm>
                                        <DescriptionListDescription>{fs.used}</DescriptionListDescription>
                                    </DescriptionListGroup>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>Available</DescriptionListTerm>
                                        <DescriptionListDescription>{fs.available}</DescriptionListDescription>
                                    </DescriptionListGroup>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>Referenced</DescriptionListTerm>
                                        <DescriptionListDescription>{fs.referenced}</DescriptionListDescription>
                                    </DescriptionListGroup>
                                    {fs.quota && (
                                        <DescriptionListGroup>
                                            <DescriptionListTerm>Quota</DescriptionListTerm>
                                            <DescriptionListDescription>{fs.quota}</DescriptionListDescription>
                                        </DescriptionListGroup>
                                    )}
                                    {fs.reservation && (
                                        <DescriptionListGroup>
                                            <DescriptionListTerm>Reservation</DescriptionListTerm>
                                            <DescriptionListDescription>{fs.reservation}</DescriptionListDescription>
                                        </DescriptionListGroup>
                                    )}
                                    {compressionRatio && (
                                        <DescriptionListGroup>
                                            <DescriptionListTerm>Compression Ratio</DescriptionListTerm>
                                            <DescriptionListDescription>
                                                <span style={{ color: '#3e8635', fontWeight: 'bold' }}>{compressionRatio}</span>
                                                {' '}
                                                <span style={{ fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                                                    ({(parseFloat(compressionRatio.replace('x', '')) - 1) * 100 > 0 ? `saves ${((parseFloat(compressionRatio.replace('x', '')) - 1) * 100).toFixed(1)}%` : 'no savings'})
                                                </span>
                                            </DescriptionListDescription>
                                        </DescriptionListGroup>
                                    )}
                                    {dedupRatio && (
                                        <DescriptionListGroup>
                                            <DescriptionListTerm>Deduplication Ratio</DescriptionListTerm>
                                            <DescriptionListDescription>
                                                <span style={{ color: '#3e8635', fontWeight: 'bold' }}>{dedupRatio}</span>
                                                {' '}
                                                <span style={{ fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                                                    (saves {((parseFloat(dedupRatio.replace('x', '')) - 1) * 100).toFixed(1)}%)
                                                </span>
                                            </DescriptionListDescription>
                                        </DescriptionListGroup>
                                    )}
                                    {fs.mountpoint && (
                                        <DescriptionListGroup>
                                            <DescriptionListTerm>Mountpoint</DescriptionListTerm>
                                            <DescriptionListDescription>{fs.mountpoint}</DescriptionListDescription>
                                        </DescriptionListGroup>
                                    )}
                                </DescriptionList>
                            </div>
                        ),
                    };
                })}
            />
        </>
    );
}

export default PoolFileSystemsTab;

