import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ListingTable } from 'cockpit-components-table.jsx';

function PoolStatusTab({ pool }) {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStatus();
    }, [pool.name]);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const proc = window.cockpit.spawn(['zpool', 'status', pool.name]);
            let output = '';
            
            proc.stream((data) => {
                output += data;
            });

            proc.done((exitCode) => {
                if (exitCode === 0) {
                    setStatusData(parseStatusOutput(output));
                } else {
                    setStatusData({ error: 'Failed to get pool status' });
                }
                setLoading(false);
            });

            proc.fail((error) => {
                setStatusData({ error: `Error: ${error}` });
                setLoading(false);
            });
        } catch (error) {
            setStatusData({ error: `Error: ${error.message}` });
            setLoading(false);
        }
    };

    const parseStatusOutput = (output) => {
        const lines = output.split('\n');
        const data = {
            pool: pool.name,
            state: 'UNKNOWN',
            status: '',
            action: '',
            scan: '',
            errors: '',
            devices: []
        };

        let currentSection = '';
        let inDeviceTable = false;
        let deviceHeaders = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Pool state line: "  pool: zfs-storage"
            if (line.startsWith('pool:')) {
                data.pool = line.replace('pool:', '').trim();
            }
            
            // State line: " state: ONLINE"
            if (line.startsWith('state:')) {
                data.state = line.replace('state:', '').trim();
            }
            
            // Status line
            if (line.startsWith('status:')) {
                data.status = line.replace('status:', '').trim();
            }
            
            // Action line
            if (line.startsWith('action:')) {
                data.action = line.replace('action:', '').trim();
            }
            
            // Scan line
            if (line.startsWith('scan:')) {
                data.scan = line.replace('scan:', '').trim();
            }
            
            // Errors line
            if (line.startsWith('errors:')) {
                data.errors = line.replace('errors:', '').trim();
            }
            
            // Device table starts with "NAME" header
            if (line.startsWith('NAME') || line.match(/^\s+NAME\s+STATE\s+READ\s+WRITE\s+CHECKSUM/)) {
                inDeviceTable = true;
                // Parse headers
                const headerLine = line.replace(/^\s+/, '');
                deviceHeaders = headerLine.split(/\s+/).filter(h => h);
                continue;
            }
            
            // Parse device rows
            if (inDeviceTable && line && !line.startsWith('pool:') && !line.startsWith('state:')) {
                // Skip separator lines
                if (line.match(/^-+$/)) continue;
                
                // Parse device row
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const device = {
                        name: parts[0],
                        state: parts[1] || '',
                        read: parts[2] || '0',
                        write: parts[3] || '0',
                        checksum: parts[4] || '0',
                        message: parts.slice(5, -1).join(' ') || '',
                        product: parts[parts.length - 1] || ''
                    };
                    data.devices.push(device);
                }
            }
        }

        return data;
    };

    const formatTimestamp = () => {
        return new Date().toLocaleString();
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading pool status" />;
    }

    if (statusData?.error) {
        return <div>{statusData.error}</div>;
    }

    const getStateColor = (state) => {
        if (state === 'ONLINE') return 'var(--pf-t--global--success--color--100)';
        if (state === 'DEGRADED' || state === 'FAULTED') return 'var(--pf-t--global--danger--color--100)';
        return 'var(--pf-t--global--warning--color--100)';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <span>{formatTimestamp()}</span>
                <Button variant="secondary" onClick={loadStatus} isDisabled={loading}>
                    Refresh
                </Button>
            </div>

            <DescriptionList isHorizontal style={{ marginBottom: 'var(--pf-t--global--spacer--lg)' }}>
                <DescriptionListGroup>
                    <DescriptionListTerm>Pool</DescriptionListTerm>
                    <DescriptionListDescription>{statusData?.pool || pool.name}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                    <DescriptionListTerm>State</DescriptionListTerm>
                    <DescriptionListDescription>
                        <span style={{ color: getStateColor(statusData?.state) }}>
                            {statusData?.state || pool.health}
                        </span>
                    </DescriptionListDescription>
                </DescriptionListGroup>
            </DescriptionList>

            {statusData?.status && (
                <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <strong>Status:</strong> {statusData.status}
                </div>
            )}

            {statusData?.action && (
                <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <strong>Action:</strong> {statusData.action}
                </div>
            )}

            {statusData?.scan && (
                <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <strong>Scan:</strong> {statusData.scan}
                </div>
            )}

            {statusData?.errors && (
                <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <strong>Errors:</strong> {statusData.errors}
                </div>
            )}

            {statusData?.devices && statusData.devices.length > 0 && (
                <div style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
                    <ListingTable
                        aria-label="Pool devices"
                        variant="compact"
                        columns={[
                            { title: "Name", header: true, props: { width: 25 } },
                            { title: "State", props: { width: 15 } },
                            { title: "Read", props: { width: 10 } },
                            { title: "Write", props: { width: 10 } },
                            { title: "Checksum", props: { width: 10 } },
                            { title: "Message", props: { width: 20 } },
                            { title: "Product", props: { width: 20 } },
                        ]}
                        rows={statusData.devices.map((device, idx) => ({
                            columns: [
                                { title: device.name, header: idx === 0 },
                                { 
                                    title: (
                                        <span style={{ color: getStateColor(device.state) }}>
                                            {device.state}
                                        </span>
                                    )
                                },
                                { title: device.read },
                                { title: device.write },
                                { title: device.checksum },
                                { title: device.message || '-' },
                                { title: device.product || '-' },
                            ],
                            props: { key: `${device.name}-${idx}` },
                        }))}
                    />
                </div>
            )}
        </div>
    );
}

export default PoolStatusTab;

