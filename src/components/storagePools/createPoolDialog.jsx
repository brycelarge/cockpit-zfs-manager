import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { ZfsApi } from '../../zfsApi/index.js';
import { VDEV_TYPES } from '../../constants/index.js';

function CreatePoolDialog({ isOpen, onClose, onCreate }) {
    const [poolName, setPoolName] = useState('');
    const [vdevType, setVdevType] = useState('stripe');
    const [devices, setDevices] = useState([]);
    const [availableDisks, setAvailableDisks] = useState([]);
    const [loadingDisks, setLoadingDisks] = useState(false);
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});

    React.useEffect(() => {
        if (isOpen) {
            loadDisks();
        }
    }, [isOpen]);

    const loadDisks = async () => {
        setLoadingDisks(true);
        try {
            const disks = await ZfsApi.listAvailableDisks();
            setAvailableDisks(disks);
            if (disks.length === 0) {
                console.warn('No disks found. Make sure lsblk is installed and you have permissions to list block devices.');
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

    const handleCreate = () => {
        const validation = {};
        const trimmedName = poolName.trim();
        
        if (!trimmedName) {
            validation.name = 'Pool name is required';
        } else {
            // ZFS pool names must start with a letter and contain only alphanumeric characters, underscores, hyphens, and colons
            if (!/^[a-zA-Z]/.test(trimmedName)) {
                validation.name = 'Pool name must start with a letter';
            } else if (!/^[a-zA-Z0-9_\-:]+$/.test(trimmedName)) {
                validation.name = 'Pool name can only contain letters, numbers, underscores, hyphens, and colons';
            } else if (trimmedName.length > 255) {
                validation.name = 'Pool name must be 255 characters or less';
            }
        }
        
        if (devices.length === 0) {
            validation.devices = 'Please select at least one device';
        }
        if (vdevType === 'mirror' && devices.length < 2) {
            validation.devices = 'Mirror requires at least 2 devices';
        }
        if (vdevType === 'raidz' && devices.length < 3) {
            validation.devices = 'RAID-Z requires at least 3 devices';
        }
        if (vdevType === 'raidz2' && devices.length < 4) {
            validation.devices = 'RAID-Z2 requires at least 4 devices';
        }
        if (vdevType === 'raidz3' && devices.length < 5) {
            validation.devices = 'RAID-Z3 requires at least 5 devices';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        onCreate({
            name: trimmedName,
            vdevType,
            devices
        });
        onClose();
    };

    return (
        <Modal
            position="top"
            variant="medium"
            id="create-pool-dialog"
            isOpen={isOpen}
            onClose={onClose}
        >
            <ModalHeader title="Create Storage Pool" />
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
                            label="Pool Name"
                            fieldId="pool-name"
                            validated={validationFailed.name ? 'error' : 'default'}
                        >
                            <TextInput
                                id="pool-name"
                                value={poolName}
                                onChange={(_, value) => {
                                    setPoolName(value);
                                    if (validationFailed.name) {
                                        setValidationFailed({ ...validationFailed, name: undefined });
                                    }
                                }}
                                validated={validationFailed.name ? 'error' : 'default'}
                            />
                            <FormHelper
                                fieldId="pool-name"
                                helperTextInvalid={validationFailed.name}
                            />
                        </FormGroup>

                        <FormGroup
                            label={
                                <span>
                                    VDEV Type
                                    <Tooltip content="Virtual Device (VDEV) type determines redundancy and performance characteristics">
                                        <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                            <HelpIcon />
                                        </span>
                                    </Tooltip>
                                </span>
                            }
                            fieldId="pool-vdev-type"
                        >
                            <FormSelect
                                id="pool-vdev-type"
                                value={vdevType}
                                onChange={(_, value) => {
                                    setVdevType(value);
                                    if (validationFailed.devices && value !== 'mirror') {
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
                                    vdevType === 'mirror' && devices.length > 0 && devices.length < 2
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
                    </Form>
                )}
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleCreate}
                    isDisabled={loadingDisks}
                >
                    Create Pool
                </Button>
                <Button variant="link" onClick={onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default CreatePoolDialog;

