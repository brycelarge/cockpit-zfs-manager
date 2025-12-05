import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";

import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import { parseSizeToBytes } from '../../utils/size.js';
import CreateFileSystemDialog from './createFileSystemDialog.jsx';
import FileSystemActions from './fileSystemActions.jsx';

function PoolFileSystemsTab({ pool, pools, onRefresh }) {
    const Dialogs = useDialogs();
    const [filesystems, setFilesystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState(new Set());

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

    const calculateUsagePercent = (used, quota, available) => {
        // If quota is set, calculate usage based on quota
        if (quota && quota !== '-' && quota !== 'none') {
            const usedBytes = parseSizeToBytes(used);
            const quotaBytes = parseSizeToBytes(quota);
            if (quotaBytes === 0) return null;
            const percent = ((usedBytes / quotaBytes) * 100).toFixed(1);
            return percent;
        }
        // Otherwise, calculate usage based on used / (used + available)
        if (available && available !== '-') {
            const usedBytes = parseSizeToBytes(used);
            const availableBytes = parseSizeToBytes(available);
            const totalBytes = usedBytes + availableBytes;
            if (totalBytes === 0) return null;
            const percent = ((usedBytes / totalBytes) * 100).toFixed(1);
            return percent;
        }
        // If we have used but no available/quota, try to calculate from used alone
        if (used && used !== '-') {
            const usedBytes = parseSizeToBytes(used);
            if (usedBytes > 0) {
                // Can't calculate percentage without total, but at least show something
                return null;
            }
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

    // Build tree structure from flat list
    const buildTree = (flatList) => {
        const tree = [];
        const nodeMap = new Map();

        // First pass: create all nodes
        flatList.forEach(fs => {
            const parts = fs.name.split('/');
            const node = {
                ...fs,
                children: [],
                level: parts.length - 1,
                parent: parts.length > 1 ? parts.slice(0, -1).join('/') : null,
                shortName: parts[parts.length - 1]
            };
            nodeMap.set(fs.name, node);
        });

        // Second pass: build tree structure
        nodeMap.forEach(node => {
            if (node.parent && nodeMap.has(node.parent)) {
                nodeMap.get(node.parent).children.push(node);
            } else {
                tree.push(node);
            }
        });

        // Sort children at each level
        const sortTree = (nodes) => {
            nodes.sort((a, b) => a.shortName.localeCompare(b.shortName));
            nodes.forEach(node => {
                if (node.children.length > 0) {
                    sortTree(node.children);
                }
            });
        };
        sortTree(tree);

        return tree;
    };

    // Render tree nodes recursively
    const renderTreeNodes = (nodes, level = 0) => {
        const rows = [];

            nodes.forEach(node => {
            const isExpanded = expandedNodes.has(node.name);
            const hasChildren = node.children.length > 0;
            // Calculate usage - ensure we always try if we have data
            let usagePercent = calculateUsagePercent(node.used, node.quota, node.available);
            // Fallback: if calculation returned null but we have used and available, try direct calculation
            if (usagePercent === null && node.used && node.used !== '-' && node.available && node.available !== '-') {
                const usedBytes = parseSizeToBytes(node.used);
                const availableBytes = parseSizeToBytes(node.available);
                if (usedBytes >= 0 && availableBytes >= 0) {
                    const totalBytes = usedBytes + availableBytes;
                    if (totalBytes > 0) {
                        usagePercent = ((usedBytes / totalBytes) * 100).toFixed(1);
                    } else if (usedBytes === 0 && availableBytes === 0) {
                        usagePercent = '0.0';
                    }
                }
            }
            const compressionRatio = formatCompressionRatio(node.compressratio);
            const dedupRatio = formatDedupRatio(node.dedupratio);

            rows.push({
                columns: [
                    {
                        title: (
                            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: `${level * 24}px` }}>
                                {hasChildren ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newExpanded = new Set(expandedNodes);
                                            if (isExpanded) {
                                                newExpanded.delete(node.name);
                                            } else {
                                                newExpanded.add(node.name);
                                            }
                                            setExpandedNodes(newExpanded);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginRight: '8px',
                                            color: 'var(--pf-t--global--text--color--default)'
                                        }}
                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 320 512"
                                            fill="currentColor"
                                            style={{
                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s'
                                            }}
                                        >
                                            <path d="M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z" />
                                        </svg>
                                    </button>
                                ) : (
                                    <span style={{ width: '20px', display: 'inline-block' }} />
                                )}
                                <span style={{ fontWeight: hasChildren ? 'bold' : 'normal' }}>{node.shortName}</span>
                            </div>
                        ),
                        header: true
                    },
                    { title: node.used },
                    { title: node.available },
                    { title: node.quota || '-' },
                    {
                        title: usagePercent !== null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pf-t--global--spacer--xs)' }}>
                                <div style={{ width: '60px', height: '16px', backgroundColor: 'var(--pf-t--global--palette--black-200)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                    {parseFloat(usagePercent) > 0 ? (
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${Math.min(Math.max(parseFloat(usagePercent) || 0, 0), 100)}%`,
                                                backgroundColor: parseFloat(usagePercent) > 90 ? '#c9190b' : parseFloat(usagePercent) > 75 ? '#f0ab00' : '#3e8635',
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
                    { title: node.mountpoint || '-' },
                    { title: <FileSystemActions filesystem={node} pool={pool} pools={pools} onRefresh={handleRefresh} /> },
                ],
                key: node.name,
                expandedContent: (
                    <div style={{ padding: 'var(--pf-t--global--spacer--md)' }}>
                        <DescriptionList isHorizontal>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Name</DescriptionListTerm>
                                <DescriptionListDescription>{node.name}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Used</DescriptionListTerm>
                                <DescriptionListDescription>{node.used}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Available</DescriptionListTerm>
                                <DescriptionListDescription>{node.available}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Referenced</DescriptionListTerm>
                                <DescriptionListDescription>{node.referenced}</DescriptionListDescription>
                            </DescriptionListGroup>
                            {node.quota && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>Quota</DescriptionListTerm>
                                    <DescriptionListDescription>{node.quota}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                            {node.reservation && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>Reservation</DescriptionListTerm>
                                    <DescriptionListDescription>{node.reservation}</DescriptionListDescription>
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
                            {node.mountpoint && (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>Mountpoint</DescriptionListTerm>
                                    <DescriptionListDescription>{node.mountpoint}</DescriptionListDescription>
                                </DescriptionListGroup>
                            )}
                        </DescriptionList>
                    </div>
                ),
            });

            // Add children if expanded
            if (hasChildren && isExpanded) {
                rows.push(...renderTreeNodes(node.children, level + 1));
            }
        });

        return rows;
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading file systems" />;
    }

    const tree = buildTree(filesystems);
    const tableRows = renderTreeNodes(tree);

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
                rows={tableRows}
            />
        </>
    );
}

export default PoolFileSystemsTab;

