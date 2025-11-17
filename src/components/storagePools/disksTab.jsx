import React, { useState, useEffect } from 'react';

import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { ListingTable } from 'cockpit-components-table.jsx';
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from "@patternfly/react-core/dist/esm/components/DescriptionList";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { DisksApi } from '../../zfsApi/disks.js';

function DisksTab({ pool }) {
    const [disks, setDisks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDisks();
    }, [pool.name]);

    const loadDisks = async () => {
        setLoading(true);
        setError(null);
        try {
            const diskList = await DisksApi.getPoolDisks(pool.name);
            console.log('Loaded disks for pool', pool.name, ':', diskList);
            setDisks(diskList);
        } catch (exc) {
            console.error('Failed to load disks:', exc);
            setError(exc.message || String(exc));
        } finally {
            setLoading(false);
        }
    };

    const formatHealth = (health) => {
        if (!health) return 'Unknown';
        
        const healthUpper = health.toUpperCase();
        if (healthUpper === 'PASSED' || healthUpper === 'OK') {
            return <span style={{ color: '#3e8635', fontWeight: 'bold' }}>PASSED</span>;
        } else if (healthUpper === 'FAILED') {
            return <span style={{ color: '#c9190b', fontWeight: 'bold' }}>FAILED</span>;
        }
        return health;
    };

    const formatTemperature = (temp) => {
        if (temp === null || temp === undefined) return '-';
        return `${temp}°C`;
    };

    if (loading) {
        return <Spinner size="lg" aria-label="Loading disk information" />;
    }

    if (error) {
        return (
            <Alert variant="warning" title="Failed to load disk information">
                {error}
            </Alert>
        );
    }

    if (disks.length === 0) {
        return (
            <Alert variant="info" title="No disks found">
                No disk devices found for this pool.
            </Alert>
        );
    }

    // Check if smartctl is available - check the first disk's smartctlAvailable flag
    const smartctlAvailable = disks.length > 0 && disks[0].smartctlAvailable === true;
    const allDisksNullSmart = disks.length > 0 && disks.every(disk => disk.smart === null);
    
    // Only show alert if smartctl is not available (not installed)
    const smartctlMissing = !smartctlAvailable && allDisksNullSmart;

    return (
        <div>
            {smartctlMissing && (
                <Alert variant="info" title="SMART data not available" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>SMART information is not available. To enable SMART data, install <code>smartmontools</code>:</p>
                    <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
                        <strong>Debian/Ubuntu:</strong> <code>sudo apt install smartmontools</code><br />
                        <strong>Fedora/RHEL:</strong> <code>sudo dnf install smartmontools</code>
                    </p>
                </Alert>
            )}
            <ListingTable
                aria-label="Pool disks"
                variant="compact"
                columns={[
                    { title: "Device", header: true, props: { width: 15 } },
                    { title: "Type", props: { width: 12 } },
                    { title: "Model", props: { width: 20 } },
                    { title: "Serial", props: { width: 15 } },
                    { title: "Capacity", props: { width: 12 } },
                    { title: "SMART Health", props: { width: 12 } },
                    { title: "Temperature", props: { width: 10 } },
                    { title: "Power On Hours", props: { width: 14 } },
                ]}
                emptyCaption="No disks found"
                rows={disks.map((disk, idx) => ({
                    columns: [
                        { title: disk.path, header: idx === 0 },
                        { title: disk.type },
                        { title: disk.smart?.model || '-' },
                        { title: disk.smart?.serial || '-' },
                        { title: disk.smart?.capacity || '-' },
                        { title: disk.smart ? formatHealth(disk.smart.health) : <span style={{ color: 'var(--pf-t--global--text--color--muted)' }}>N/A</span> },
                        { title: disk.smart ? formatTemperature(disk.smart.temperature) : '-' },
                        { title: disk.smart?.powerOnHours ? `${disk.smart.powerOnHours} hours` : '-' },
                    ],
                    key: disk.path,
                    expandedContent: disk.smart && (
                        <div style={{ padding: 'var(--pf-t--global--spacer--md)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--pf-t--global--spacer--md)', marginBottom: 'var(--pf-t--global--spacer--lg)' }}>
                                {/* Health Widget */}
                                <Card>
                                    <CardTitle>Health</CardTitle>
                                    <CardBody>
                                        <DescriptionList isHorizontal>
                                            <DescriptionListGroup>
                                                <DescriptionListTerm>Status</DescriptionListTerm>
                                                <DescriptionListDescription>
                                                    {formatHealth(disk.smart.health)}
                                                </DescriptionListDescription>
                                            </DescriptionListGroup>
                                            {disk.smart.temperature !== null && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Temperature</DescriptionListTerm>
                                                    <DescriptionListDescription>{formatTemperature(disk.smart.temperature)}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                        </DescriptionList>
                                    </CardBody>
                                </Card>

                                {/* Information Widget */}
                                <Card>
                                    <CardTitle>Information</CardTitle>
                                    <CardBody>
                                        <DescriptionList isHorizontal>
                                            {disk.smart.model && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Model</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.model}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.serial && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Serial Number</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.serial}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.capacity && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Size</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.capacity}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.type && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Type</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.type}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.interface && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Interface</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.interface}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.transferMode && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Transfer Mode</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.transferMode}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.rotationRate !== null && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Rotation Rate</DescriptionListTerm>
                                                    <DescriptionListDescription>
                                                        {disk.smart.rotationRate === 0 ? '-' : `${disk.smart.rotationRate} rpm`}
                                                    </DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.firmware && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Firmware</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.firmware}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.physicalBlockSize && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Physical Block Size</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.physicalBlockSize}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.wwn && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>WWN</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.wwn}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            <DescriptionListGroup>
                                                <DescriptionListTerm>Pools</DescriptionListTerm>
                                                <DescriptionListDescription>
                                                    <a href="#" onClick={(e) => { e.preventDefault(); }}>{pool.name}</a>
                                                </DescriptionListDescription>
                                            </DescriptionListGroup>
                                        </DescriptionList>
                                    </CardBody>
                                </Card>

                                {/* Stats Widget */}
                                <Card>
                                    <CardTitle>Stats</CardTitle>
                                    <CardBody>
                                        <DescriptionList isHorizontal>
                                            {disk.smart.hostReads !== null && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Total Host Reads</DescriptionListTerm>
                                                    <DescriptionListDescription>{DisksApi.formatBytes(disk.smart.hostReads)}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.hostWrites !== null && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Total Host Writes</DescriptionListTerm>
                                                    <DescriptionListDescription>{DisksApi.formatBytes(disk.smart.hostWrites)}</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.powerCycleCount !== null && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Power On Count</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.powerCycleCount} times</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                            {disk.smart.powerOnHours !== null && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>Power On Hours</DescriptionListTerm>
                                                    <DescriptionListDescription>{disk.smart.powerOnHours} hours</DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                        </DescriptionList>
                                    </CardBody>
                                </Card>
                            </div>

                            {/* S.M.A.R.T. Attributes Table */}
                            {disk.smart.attributes && disk.smart.attributes.length > 0 && (
                                <Card>
                                    <CardTitle>S.M.A.R.T.</CardTitle>
                                    <CardBody>
                                        <ListingTable
                                            aria-label="SMART attributes"
                                            variant="compact"
                                            columns={[
                                                { title: "ID", props: { width: 5 } },
                                                { title: "Attribute Name", header: true, props: { width: 25 } },
                                                { title: "Current", props: { width: 10 } },
                                                { title: "Worst", props: { width: 10 } },
                                                { title: "Threshold", props: { width: 12 } },
                                                { title: "Raw Value", props: { width: 20 } },
                                            ]}
                                            rows={disk.smart.attributes.map(attr => ({
                                                columns: [
                                                    { title: attr.id.toString() },
                                                    { title: attr.name, header: true },
                                                    { title: attr.value.toString() },
                                                    { title: attr.worst.toString() },
                                                    { title: attr.threshold.toString() },
                                                    { title: attr.rawValue !== null ? attr.rawValue.toString() : '-' },
                                                ],
                                                key: `attr-${attr.id}`,
                                            }))}
                                        />
                                    </CardBody>
                                </Card>
                            )}
                        </div>
                    ),
                }))}
            />
        </div>
    );
}

export default DisksTab;

