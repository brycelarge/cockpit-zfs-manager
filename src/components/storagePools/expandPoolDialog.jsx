import React, { useState, useEffect } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import { DisksApi } from '../../zfsApi/disks.js';

function ExpandPoolDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [vdevType, setVdevType] = useState(pool.vdevType || 'stripe');
    const [devices, setDevices] = useState([]);
    const [availableDisks, setAvailableDisks] = useState([]);
    const [loadingDisks, setLoadingDisks] = useState(false);
    const [force, setForce] = useState(false);
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});
    const [expanding, setExpanding] = useState(false);

    useEffect(() => {
        loadPoolVdevType();
        loadDisks();
    }, []);

    const loadPoolVdevType = async () => {
        try {
            // Get the current pool's VDEV type if not already set
            if (!pool.vdevType) {
                const currentVdevType = await ZfsApi.getPoolVdevType(pool.name);
                setVdevType(currentVdevType || 'stripe');
            }
        } catch (error) {
            // If we can't get the VDEV type, default to stripe
            console.warn('Could not determine pool VDEV type, defaulting to stripe:', error);
        }
    };

    const loadDisks = async () => {
        setLoadingDisks(true);
        try {
            // Get all available disks
            const allDisks = await ZfsApi.listAvailableDisks();
            
            // Get devices already in the pool
            const poolDevices = await DisksApi.getPoolDevices(pool.name);
            const poolDevicePaths = new Set(poolDevices.map(d => d.path));
            
            // Filter out disks already in the pool
            const filteredDisks = allDisks.filter(disk => !poolDevicePaths.has(disk.path));
            
            setAvailableDisks(filteredDisks);
            if (filteredDisks.length === 0) {
                console.warn('No available disks found that are not already part of the pool.');
            }
        } catch (error) {
            console.error('Failed to load disks:', error);
            setError({
                dialogError: 'Failed to load available disks',
                dialogErrorDetail: error.message || String(error)
            });
        } finally {
            setLoadingDisks(false);
        }
    };

    const handleDeviceToggle = (devicePath, checked) => {
        if (checked) {
            setDevices([...devices, devicePath]);
        } else {
            setDevices(devices.filter(d => d !== devicePath));
        }
    };

    const handleExpand = async () => {
        const validation = {};
        if (devices.length === 0) {
            validation.devices = 'Please select at least one device';
        }
        if (vdevType === 'mirror' && devices.length < 2) {
            validation.devices = 'Mirror requires at least 2 devices';
        } else if (vdevType === 'raidz' && devices.length < 3) {
            validation.devices = 'RAID-Z requires at least 3 devices';
        } else if (vdevType === 'raidz2' && devices.length < 4) {
            validation.devices = 'RAID-Z2 requires at least 4 devices';
        } else if (vdevType === 'raidz3' && devices.length < 5) {
            validation.devices = 'RAID-Z3 requires at least 5 devices';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        setExpanding(true);
        setError({});
        try {
            await ZfsApi.addVdevToPool(pool.name, vdevType, devices, force);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to expand pool',
                dialogErrorDetail: exc.message || String(exc)
            });
            setExpanding(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Expand Pool: ${pool.name}`} />
            <ModalBody>
                {loadingDisks ? (
                    <Spinner size="lg" />
                ) : (
                    <Form isHorizontal>
                        {error.dialogError && (
                            <ModalError
                                dialogError={error.dialogError}
                                {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                            />
                        )}

                        <FormGroup
                            label="VDEV Type"
                            fieldId="pool-vdev-type"
                        >
                            <FormSelect
                                id="pool-vdev-type"
                                value={vdevType}
                                onChange={(_, value) => {
                                    setVdevType(value);
                                    if (validationFailed.devices) {
                                        setValidationFailed({ ...validationFailed, devices: undefined });
                                    }
                                }}
                            >
                                <FormSelectOption value="stripe" label="Stripe (No redundancy)" />
                                <FormSelectOption value="mirror" label="Mirror (requires 2+ devices)" />
                                <FormSelectOption value="raidz" label="RAID-Z (single parity, requires 3+ devices)" />
                                <FormSelectOption value="raidz2" label="RAID-Z2 (double parity, requires 4+ devices)" />
                                <FormSelectOption value="raidz3" label="RAID-Z3 (triple parity, requires 5+ devices)" />
                            </FormSelect>
                            <FormHelper
                                fieldId="pool-vdev-type"
                                helperText={`Current pool VDEV type: ${pool.vdevType || 'stripe'}. You can add a different VDEV type, but keeping types consistent is recommended.`}
                            />
                        </FormGroup>

                        <FormGroup
                            label="Select Devices"
                            fieldId="pool-devices"
                            validated={validationFailed.devices ? 'error' : 'default'}
                        >
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--pf-t--global--border--color--default)', borderRadius: 'var(--pf-t--global--border--radius--small)', padding: 'var(--pf-t--global--spacer--sm)' }}>
                                {availableDisks.length === 0 ? (
                                    <div style={{ padding: 'var(--pf-t--global--spacer--md)', textAlign: 'center', color: 'var(--pf-t--global--text--color--muted)' }}>
                                        No available disks found
                                    </div>
                                ) : (
                                    availableDisks.map(disk => (
                                        <Checkbox
                                            key={disk.path}
                                            id={`disk-${disk.path.replace(/\//g, '-')}`}
                                            label={
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <span>
                                                        <strong>{disk.path}</strong>
                                                        {disk.name && disk.name !== disk.path.replace('/dev/', '') && (
                                                            <><br /><small>{disk.name}</small></>
                                                        )}
                                                    </span>
                                                    <span style={{ marginLeft: 'auto', color: 'var(--pf-t--global--text--color--muted)' }}>
                                                        {disk.size}
                                                    </span>
                                                </div>
                                            }
                                            isChecked={devices.includes(disk.path)}
                                            onChange={(_, checked) => {
                                                handleDeviceToggle(disk.path, checked);
                                                if (validationFailed.devices) {
                                                    setValidationFailed({ ...validationFailed, devices: undefined });
                                                }
                                            }}
                                        />
                                    ))
                                )}
                            </div>
                            <FormHelper
                                fieldId="pool-devices"
                                helperTextInvalid={validationFailed.devices}
                                helperText={
                                    devices.length === 0
                                        ? 'Select devices to add to the pool'
                                        : vdevType === 'mirror' && devices.length > 0 && devices.length < 2
                                            ? 'Mirror requires at least 2 devices'
                                            : vdevType === 'raidz' && devices.length > 0 && devices.length < 3
                                                ? 'RAID-Z requires at least 3 devices'
                                                : vdevType === 'raidz2' && devices.length > 0 && devices.length < 4
                                                    ? 'RAID-Z2 requires at least 4 devices'
                                                    : vdevType === 'raidz3' && devices.length > 0 && devices.length < 5
                                                        ? 'RAID-Z3 requires at least 5 devices'
                                                        : undefined
                                }
                            />
                        </FormGroup>

                        <Checkbox
                            id="force-expand-pool"
                            label="Force expansion (overwrite existing filesystems on devices)"
                            isChecked={force}
                            onChange={(_, checked) => setForce(checked)}
                        />
                        <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                            Use this if devices contain existing filesystems that you want to overwrite.
                        </p>
                    </Form>
                )}
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleExpand}
                    isDisabled={loadingDisks || expanding}
                    isLoading={expanding}
                >
                    Expand Pool
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={loadingDisks || expanding}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ExpandPoolDialog;

